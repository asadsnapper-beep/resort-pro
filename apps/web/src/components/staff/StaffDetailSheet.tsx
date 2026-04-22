'use client';

import { X, Mail, Phone, Briefcase, Building2, Calendar, Pencil, UserX, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, getInitials } from '@/lib/utils';

interface Staff {
  id: string;
  department: string;
  position: string;
  phone?: string;
  hireDate: string;
  isActive: boolean;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    lastLoginAt?: string;
  };
}

interface Props {
  staff: Staff | null;
  onClose: () => void;
  onEdit: (staff: Staff) => void;
  onDeactivate: (staff: Staff) => void;
}

const DEPT_COLORS: Record<string, string> = {
  FRONT_DESK: 'bg-blue-100 text-blue-700',
  HOUSEKEEPING: 'bg-green-100 text-green-700',
  RESTAURANT: 'bg-orange-100 text-orange-700',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700',
  SECURITY: 'bg-red-100 text-red-700',
  MANAGEMENT: 'bg-purple-100 text-purple-700',
};

function formatDept(d: string) {
  return d.replace(/_/g, ' ');
}

function getDaysEmployed(hireDate: string) {
  const days = Math.floor((Date.now() - new Date(hireDate).getTime()) / 86400000);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m > 0 ? `${y}y ${m}mo` : `${y}y`;
}

export function StaffDetailSheet({ staff, onClose, onEdit, onDeactivate }: Props) {
  if (!staff) return null;

  const initials = getInitials(staff.user.firstName, staff.user.lastName);
  const deptColor = DEPT_COLORS[staff.department] ?? 'bg-gray-100 text-gray-700';
  const tenure = getDaysEmployed(staff.hireDate);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-resort-100 text-lg font-bold text-resort-700">
                {initials}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${staff.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{staff.user.firstName} {staff.user.lastName}</h2>
              <p className="text-xs text-muted-foreground">{staff.position}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Status + Department */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${deptColor}`}>
                <Building2 className="mr-1.5 h-3 w-3" />
                {formatDept(staff.department)}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${staff.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <Shield className="mr-1.5 h-3 w-3" />
                {staff.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Tenure Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Tenure', value: tenure },
                { label: 'Hired', value: formatDate(staff.hireDate) },
                { label: 'Last Login', value: staff.user.lastLoginAt ? formatDate(staff.user.lastLoginAt) : 'Never' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Contact Details</h3>
              <div className="space-y-2.5">
                {[
                  { icon: Mail, label: staff.user.email },
                  { icon: Phone, label: staff.phone ?? '—' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={label === '—' ? 'text-muted-foreground' : 'text-gray-900'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Employment Details */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Employment Details</h3>
              <div className="space-y-2.5">
                {[
                  { icon: Briefcase, label: 'Position', value: staff.position },
                  { icon: Building2, label: 'Department', value: formatDept(staff.department) },
                  { icon: Calendar, label: 'Hire Date', value: formatDate(staff.hireDate) },
                  { icon: Clock, label: 'Tenure', value: tenure },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
                    <span className="text-gray-900 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Account Access */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> System Access
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Login Email</span>
                <span className="font-medium">{staff.user.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Role</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">STAFF</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Account Status</span>
                <span className={`font-medium ${staff.user.isActive ? 'text-green-600' : 'text-red-500'}`}>
                  {staff.user.isActive ? 'Active' : 'Deactivated'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t px-6 py-4">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(staff)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          {staff.isActive && (
            <Button variant="destructive" className="gap-2" onClick={() => onDeactivate(staff)}>
              <UserX className="h-4 w-4" /> Deactivate
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
