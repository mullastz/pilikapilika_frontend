import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AgencyService, AgencyStage, AgencyActivity, StaffEditor, StaffInvitationResponse, StaffMember } from '../../core/services/agency.service';
import { ToastService } from '../../core/services/toast.service';

@Component({ selector: 'app-agency-team', imports: [CommonModule, FormsModule, RouterLink], templateUrl: './agency-team.html' })
export class AgencyTeam implements OnInit {
  private readonly api = inject(AgencyService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly members = signal<StaffMember[]>([]);
  readonly stages = signal<AgencyStage[]>([]);
  readonly activity = signal<AgencyActivity[]>([]);
  readonly loading = signal(true);
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
      next: response => { this.members.set(response.data.staff); this.stages.set(response.data.stages); this.activity.set(response.data.activity); },
      error: error => this.error.set(this.message(error)),
    });
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
  activityLabel(action: string): string { return action.replace(/_/g, ' '); }
  private message(error: HttpErrorResponse): string {
    const messages = Object.values(error.error?.errors || {}).flat();
    return messages.find((value): value is string => typeof value === 'string') || error.error?.message || 'Unable to update your team. Please try again.';
  }
}
