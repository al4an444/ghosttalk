import { supabase } from './supabase';
import type { Group } from '../types';

export const api = {
    // Contacts
    getContacts: async (currentUserId: string) => {
        const { data, error } = await supabase
            .from('contacts')
            .select('contact:contact_id (id, username, public_key_encryption, public_key_signing)')
            .eq('user_id', currentUserId);

        if (error) throw error;
        // Flatten structure
        return data.map((d: any) => d.contact);
    },

    addContact: async (currentUserId: string, contactId: string) => {
        const { error } = await supabase
            .from('contacts')
            .insert({ user_id: currentUserId, contact_id: contactId });

        if (error) throw error;
    },

    findUser: async (username: string, code: string) => {
        const { data, error } = await supabase
            .rpc('find_user_by_code', { p_username: username, p_code: code });

        if (error) throw error;
        return data[0] || null; // RPC returns array
    },

    // Groups
    createGroup: async (name: string, creatorId: string, memberIds: string[]) => {
        // 1. Create Group
        const { data: groupData, error: groupError } = await supabase
            .from('groups')
            .insert({ name, created_by: creatorId })
            .select()
            .single();

        if (groupError) throw groupError;

        // 2. Add Members (including creator)
        const allMembers = [...memberIds, creatorId];
        const membersPayload = allMembers.map(uid => ({
            group_id: groupData.id,
            user_id: uid
        }));

        const { error: membersError } = await supabase
            .from('group_members')
            .insert(membersPayload);

        if (membersError) throw membersError;

        return groupData;
    },

    getMyGroups: async (currentUserId: string) => {
        // Get groups where I am a member
        const { data: memberData, error: memberError } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', currentUserId);

        if (memberError) throw memberError;

        const groupIds = memberData.map(m => m.group_id);

        if (groupIds.length === 0) return [];

        const { data: groupsData, error: groupsError } = await supabase
            .from('groups')
            .select('*')
            .in('id', groupIds);

        if (groupsError) throw groupsError;
        return groupsData as Group[];
    },

    getGroupMembers: async (groupId: string) => {
        const { data, error } = await supabase
            .from('group_members')
            .select('user_id, users:user_id (id, username, public_key_encryption, public_key_signing)')
            .eq('group_id', groupId);

        if (error) throw error;
        // Flatten the structure
        return data.map((d: any) => d.users);
    },

    // Auth
    getAuthData: async (username: string) => {
        const { data, error } = await supabase
            .rpc('get_auth_data', { p_username: username });

        if (error) throw error;
        return data[0] || null;
    }
};
