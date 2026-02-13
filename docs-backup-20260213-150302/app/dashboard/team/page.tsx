'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/lib/context/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { Users, UserPlus, Crown, Shield, Eye, Trash2, AlertCircle } from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'accountant' | 'read_only';
  created_at: string;
  user?: {
    email: string;
    full_name: string | null;
  };
}

export default function TeamPage() {
  const { currentOrganization } = useOrganization();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      const fetchTeamMembers = async () => {
        try {
          setLoading(true);
          setError(null);

          const response = await fetch(`/api/organizations/${currentOrganization.id}/members`);
          if (!response.ok) throw new Error('Failed to fetch team members');
          const data = await response.json();
          const mapped: TeamMember[] = (data.members || []).map((m: { userId: string; email: string; name: string | null; role: 'owner' | 'admin' | 'accountant' | 'read_only'; joinedAt: string }) => ({
            id: m.userId,
            user_id: m.userId,
            role: m.role,
            created_at: m.joinedAt,
            user: {
              email: m.email,
              full_name: m.name,
            },
          }));
          setMembers(mapped);
          // Determine current user role from the members list
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const currentMember = mapped.find((m) => m.user_id === user.id);
            setCurrentUserRole(currentMember?.role || null);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load team members');
        } finally {
          setLoading(false);
        }
      };
      fetchTeamMembers();
    }
  }, [currentOrganization]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'accountant':
        return <Users className="w-4 h-4" />;
      case 'read_only':
        return <Eye className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      case 'accountant':
        return 'Accountant';
      case 'read_only':
        return 'Read Only';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'owner':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'admin':
        return 'text-purple-400 bg-purple-500/10';
      case 'accountant':
        return 'text-blue-400 bg-blue-500/10';
      case 'read_only':
        return 'text-white/60 bg-white/[0.06]';
      default:
        return 'text-white/60 bg-white/[0.06]';
    }
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-white/60 mx-auto mb-3" />
          <p className="text-white/60">Please select an organization</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Team Members</h1>
          <p className="text-white/60">
            Manage team members and their access levels
          </p>
        </div>
        <button
          className="px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg flex items-center space-x-2 transition-colors"
          disabled={currentUserRole !== 'owner' && currentUserRole !== 'admin'}
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Role Legend */}
      <div className="mb-6 p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
        <h3 className="text-sm font-medium text-white/60 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-start space-x-2">
            <Crown className="w-4 h-4 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Owner</p>
              <p className="text-xs text-white/60">Full control & billing</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-purple-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Admin</p>
              <p className="text-xs text-white/60">Manage members & settings</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <Users className="w-4 h-4 text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Accountant</p>
              <p className="text-xs text-white/60">View & analyze data</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <Eye className="w-4 h-4 text-white/60 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Read Only</p>
              <p className="text-xs text-white/60">View reports only</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-500 font-medium">Coming Soon</p>
            <p className="text-yellow-400/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/[0.06] rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.06] rounded w-1/3" />
                  <div className="h-3 bg-white/[0.06] rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Members List */}
      {!loading && !error && members.length === 0 && (
        <div className="text-center py-12 bg-white/[0.02] rounded-lg border border-white/[0.06]">
          <Users className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <p className="text-white/60 mb-2">No team members yet</p>
          <p className="text-sm text-white/40">Invite team members to collaborate</p>
        </div>
      )}

      {!loading && !error && members.length > 0 && (
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {member.user?.full_name?.[0] || member.user?.email[0].toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div>
                    <p className="font-medium text-white">
                      {member.user?.full_name || member.user?.email}
                    </p>
                    {member.user?.full_name && (
                      <p className="text-sm text-white/60">{member.user.email}</p>
                    )}
                  </div>
                </div>

                {/* Role Badge & Actions */}
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${getRoleColor(member.role)}`}
                  >
                    {getRoleIcon(member.role)}
                    <span>{getRoleLabel(member.role)}</span>
                  </span>

                  {currentUserRole === 'owner' && member.role !== 'owner' && (
                    <button
                      className="p-2 text-white/60 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
