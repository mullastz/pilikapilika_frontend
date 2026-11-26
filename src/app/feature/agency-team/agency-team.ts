import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, finalize } from 'rxjs';
import { AgencyService, AgencyStage, StaffEditor, StaffInvitationResponse, StaffMember, TeamActivityEntry, TeamActivityFilters } from '../../core/services/agency.service';
import { ToastService } from '../../core/services/toast.service';

/** Friendly label, icon and colour for each recorded team action. */
const ACTIVITY_META: Record<string, { label: string; icon: string; tone: string }> = {
  staff_invited: { label: 'Invited to the team', icon: 'fa-envelope', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  invitation_renewed: { label: 'Invitation resent', icon: 'fa-paper-plane', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  invitation_accepted: { label: 'Joined the team', icon: 'fa-user-check', tone: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  staff_updated: { label: 'Responsibilities updated', icon: 'fa-pen', tone: 'bg-gray-100 text-gray-700 dark:bg-[#292929] dark:text-gray-300' },
  staff_disabled: { label: 'Access disabled', icon: 'fa-user-lock', tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  confirm: { label: 'Confirmed booking', icon: 'fa-circle-check', tone: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  reject: { label: 'Rejected booking', icon: 'fa-ban', tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancel: { label: 'Cancelled parcel', icon: 'fa-xmark', tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  receive: { label: 'Received at warehouse', icon: 'fa-warehouse', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  add_received: { label: 'Received remaining quantity', icon: 'fa-boxes-stacked', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  load: { label: 'Loaded into container/batch', icon: 'fa-dolly', tone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  advance_parcel: { label: 'Moved parcel to next stage', icon: 'fa-forward', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  deliver: { label: 'Delivered to client', icon: 'fa-hand-holding-heart', tone: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  create_container: { label: 'Created container/batch', icon: 'fa-box', tone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  close_container: { label: 'Closed container/batch', icon: 'fa-lock', tone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  advance_container: { label: 'Moved container/batch', icon: 'fa-ship', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
};

interface ActivityFilterForm { staff_id: string; status: string; action: string; from: string; to: string; q: string; }
const EMPTY_FILTERS: ActivityFilterForm = { staff_id: '', status: '', action: '', from: '', to: '', q: '' };

@Component({ selector: 'app-agency-team', imports: [CommonModule, FormsModule, RouterLink], templateUrl: './agency-team.html' })
export class AgencyTeam implements OnInit {
  private readonly api = inject(AgencyService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly members = signal<StaffMember[]>([]);
  readonly stages = signal<AgencyStage[]>([]);
  readonly loading = signal(true);

  // ── Team activity (filterable, paginated) ─────────────────────
  filters: ActivityFilterForm = { ...EMPTY_FILTERS };
  readonly activityEntries = signal<TeamActivityEntry[]>([]);
  readonly activityActions = signal<string[]>([]);
  readonly activityTotal = signal(0);
  readonly activityHasMore = signal(false);
  readonly activityLoading = signal(false);
  readonly activityLoadingMore = signal(false);
  readonly activityError = signal('');
  readonly quickRange = signal<'' | 'today' | '7d' | '30d'>('');
  readonly quickRanges = [
    { id: 'today', label: 'Today' }, { id: '7d', label: 'Last 7 days' }, { id: '30d', label: 'Last 30 days' },
  ] as const;
  private activityPage = 1;
  private activityRequest: Subscription | null = null;
  readonly activityGroups = computed(() => {
    const groups: { label: string; entries: TeamActivityEntry[] }[] = [];
    for (const entry of this.activityEntries()) {
      const label = this.dayLabel(entry.created_at);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.entries.push(entry); else groups.push({ label, entries: [entry] });
    }
    return groups;
  });
  get activeFilterCount(): number { return Object.values(this.filters).filter(Boolean).length; }
  readonly saving = signal(false);
  readonly error = signal('');
  readonly editor = signal<StaffEditor | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly invitationLink = signal('');
  readonly invitationMessage = signal('');
  readonly invitationEmail = signal('');
  readonly invitationEmailQueued = signal(false);
  readonly formError = signal('');

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.api.team().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({
      next: response => { this.members.set(response.data.staff); this.stages.set(response.data.stages); this.loadActivity(); },
      error: error => this.error.set(this.message(error)),
    });
  }

  loadActivity(loadMore = false): void {
    if (loadMore && (!this.activityHasMore() || this.activityLoadingMore())) return;
    this.activityRequest?.unsubscribe();
    const page = loadMore ? this.activityPage + 1 : 1;
    (loadMore ? this.activityLoadingMore : this.activityLoading).set(true);
    this.activityError.set('');
    this.activityRequest = this.api.teamActivity(this.requestFilters(), page)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { this.activityLoading.set(false); this.activityLoadingMore.set(false); }))
      .subscribe({
        next: response => {
          const data = response.data;
          this.activityEntries.set(loadMore ? [...this.activityEntries(), ...data.activity] : data.activity);
          this.activityActions.set(data.actions);
          this.activityTotal.set(data.pagination.total);
          this.activityHasMore.set(data.pagination.has_more);
          this.activityPage = page;
        },
        error: error => this.activityError.set(this.message(error)),
      });
  }
  /** Called when a filter changes; a manual date edit replaces any quick range. */
  applyFilters(fromDateInput = false): void {
    if (fromDateInput) this.quickRange.set('');
    if (this.filters.from && this.filters.to && this.filters.from > this.filters.to) {
      this.activityError.set('The "From" date and time must be before the "To" date and time.');
      return;
    }
    this.loadActivity();
  }
  setQuickRange(range: 'today' | '7d' | '30d'): void {
    const now = new Date();
    const start = new Date(now);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else start.setDate(now.getDate() - (range === '7d' ? 7 : 30));
    this.filters = { ...this.filters, from: this.toLocalInput(start), to: '' };
    this.quickRange.set(range);
    this.loadActivity();
  }
  filterByMember(staffId: string | undefined): void {
    if (!staffId) return;
    this.filters = { ...this.filters, staff_id: staffId };
    this.loadActivity();
  }
  clearFilters(): void {
    this.filters = { ...EMPTY_FILTERS };
    this.quickRange.set('');
    this.loadActivity();
  }
  activityMeta(action: string) {
    return ACTIVITY_META[action] ?? { label: this.activityLabel(action), icon: 'fa-circle-dot', tone: 'bg-gray-100 text-gray-700 dark:bg-[#292929] dark:text-gray-300' };
  }
  initials(entry: TeamActivityEntry): string {
    return `${entry.staff?.firstname?.[0] ?? ''}${entry.staff?.lastname?.[0] ?? ''}`.toUpperCase() || '?';
  }
  private requestFilters(): TeamActivityFilters {
    const { from, to, ...rest } = this.filters;
    // datetime-local values are in the viewer's time zone; send absolute ISO timestamps.
    return { ...rest, q: rest.q.trim(), from: from ? new Date(from).toISOString() : '', to: to ? new Date(to).toISOString() : '' };
  }
  private toLocalInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  private dayLabel(value: string | null): string {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(date); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  add(): void {
    this.editingId.set(null); this.formError.set('');
    this.editor.set({ firstname: '', lastname: '', email: '', job_title: '', statuses: [], active: true });
  }
  edit(member: StaffMember): void {
    this.editingId.set(member.id); this.formError.set('');
    this.editor.set({ firstname: member.user.firstname, lastname: member.user.lastname, job_title: member.job_title || '', statuses: [...member.statuses], active: member.active });
  }
  toggleStatus(status: string): void {
    this.editor.update(editor => editor ? { ...editor, statuses: editor.statuses.includes(status) ? editor.statuses.filter(value => value !== status) : [...editor.statuses, status] } : null);
  }
  selectAll(): void { this.editor.update(editor => editor ? { ...editor, statuses: this.stages().map(stage => stage.status) } : null); }
  save(): void {
    const data = this.editor(); if (!data || this.saving()) return;
    if (!data.firstname.trim() || !data.lastname.trim() || !data.statuses.length) { this.formError.set('Enter their name and select at least one shipment status.'); return; }
    this.saving.set(true); this.formError.set('');
    const id = this.editingId();
    if (id) {
      this.api.update(id, data).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
        next: response => { this.toast.success(response.message); this.editor.set(null); this.load(); },
        error: error => this.formError.set(this.message(error)),
      });
    } else {
      this.api.invite(data).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
        next: response => { this.showInvitation(response); this.editor.set(null); this.load(); },
        error: error => this.formError.set(this.message(error)),
      });
    }
  }
  setActive(member: StaffMember): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.update(member.id, { firstname: member.user.firstname, lastname: member.user.lastname, job_title: member.job_title || '', statuses: member.statuses, active: !member.active })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
        next: response => { this.toast.success(response.message); this.load(); }, error: error => this.toast.error(this.message(error)),
      });
  }
  resend(member: StaffMember): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.resend(member.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: response => { this.showInvitation(response); this.load(); },
      error: error => this.toast.error(this.message(error)),
    });
  }
  private showInvitation(response: StaffInvitationResponse): void {
    this.invitationLink.set(response.data.invitation_url);
    this.invitationMessage.set(response.message);
    this.invitationEmail.set(response.data.staff.user.email);
    this.invitationEmailQueued.set(response.data.email_queued);
    if (response.data.email_queued) this.toast.success(response.message);
    else this.toast.error(response.message);
  }
  async copyInvitation(): Promise<void> {
    try { await navigator.clipboard.writeText(this.invitationLink()); this.toast.success('Invitation link copied.'); }
    catch { this.toast.info('Select the invitation link and copy it.'); }
  }
  stageLabel(status: string): string { return this.stages().find(stage => stage.status === status)?.label || status; }
  activityLabel(action: string): string { const text = action.replace(/_/g, ' '); return text.charAt(0).toUpperCase() + text.slice(1); }
  stageList(statuses: string[] | null): string { return (statuses || []).map(status => this.stageLabel(status)).join(', '); }
  private message(error: HttpErrorResponse): string {
    const messages = Object.values(error.error?.errors || {}).flat();
    return messages.find((value): value is string => typeof value === 'string') || error.error?.message || 'Unable to update your team. Please try again.';
  }
}
