import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTable, TableColumn } from '../../../shared/data-table/data-table';
import { AdminService } from '../../../core/services/admin.service';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';
import { Agent } from '../../../core/interfaces/auth.interface';

@Component({
  selector: 'app-admin-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  templateUrl: './agents.html',
  styleUrl: './agents.css'
})
export class AdminAgents implements OnInit {
  activeTab = signal<'all' | 'pending'>('all');
  agents = signal<Agent[]>([]);
  pendingAgents = signal<Agent[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  lastPage = signal(1);
  total = signal(0);
  searchQuery = signal('');
  modalMode = signal<'none' | 'view' | 'edit'>('none');
  selectedAgent = signal<any | null>(null);

  columns: TableColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'firstname', label: 'Name', format: (v, row) => `${row.firstname || ''} ${row.lastname || ''}`.trim() || row.username },
    { key: 'email', label: 'Email' },
    { key: 'region', label: 'Region' },
    { key: 'is_agent_verified', label: 'Status', badge: (v) => v
      ? { text: 'Verified', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
      : { text: 'Pending', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' }
    },
    { key: 'created_at', label: 'Joined', format: (v) => v ? new Date(v).toLocaleDateString() : '-' },
  ];

  constructor(
    private adminService: AdminService,
    private agentService: AgentService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAgents();
    this.loadPending();
  }

  loadAgents(): void {
    this.loading.set(true);
    this.adminService.getAgents({
      page: this.currentPage(),
      per_page: 15,
      search: this.searchQuery() || undefined,
    }).subscribe({
      next: (res: any) => {
        this.agents.set(res.data || []);
        this.currentPage.set(res.current_page || 1);
        this.lastPage.set(res.last_page || 1);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Failed to load agents');
        this.loading.set(false);
      }
    });
  }

  loadPending(): void {
    this.agentService.getPendingVerifications().subscribe({
      next: (agents) => {
        this.pendingAgents.set(agents);
      },
      error: () => this.toastService.error('Failed to load pending verifications')
    });
  }

  onVerify(agent: Agent): void {
    this.agentService.verifyAgent(agent.id).subscribe({
      next: () => {
        this.toastService.success('Agent verified successfully');
        this.loadAgents();
        this.loadPending();
      },
      error: () => this.toastService.error('Failed to verify agent')
    });
  }

  onReject(agent: Agent): void {
    const reason = prompt('Reason for rejection?');
    if (!reason) return;
    this.agentService.rejectAgent(agent.id, reason).subscribe({
      next: () => {
        this.toastService.success('Agent verification rejected');
        this.loadAgents();
        this.loadPending();
      },
      error: () => this.toastService.error('Failed to reject agent')
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadAgents();
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadAgents();
    }
  }

  onView(agent: Agent): void {
    this.selectedAgent.set({ ...agent });
    this.modalMode.set('view');
  }

  onEdit(agent: Agent): void {
    this.selectedAgent.set({ ...agent });
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set('none');
    this.selectedAgent.set(null);
  }

  saveAgentEdit(): void {
    const agent = this.selectedAgent();
    if (!agent) return;
    const payload = {
      firstname: agent.firstname,
      lastname: agent.lastname,
      email: agent.email,
      phone: agent.phone,
      role: agent.role,
      region: agent.region,
      district: agent.district,
    };
    this.adminService.updateUser(agent.id, payload).subscribe({
      next: () => {
        this.toastService.success('Agent updated');
        this.closeModal();
        this.loadAgents();
      },
      error: () => this.toastService.error('Failed to update agent')
    });
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.currentPage.update(p => p + 1);
      this.loadAgents();
    }
  }
}
