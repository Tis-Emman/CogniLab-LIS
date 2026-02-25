import { supabase } from './supabaseClient';

// USERS QUERIES
export const fetchUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data || [];
};

export const addUser = async (user: {
  full_name: string;
  email: string;
  role: 'member' | 'faculty';
  department: string;
}) => {
  const encryptionKey = `ENC_KEY_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department,
        encryption_key: encryptionKey,
      },
    ])
    .select();
  
  if (error) {
    console.error('Error adding user:', error);
    return null;
  }
  return data?.[0] || null;
};

export const updateUser = async (id: string, user: any) => {
  const { data, error } = await supabase
    .from('users')
    .update(user)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating user:', error);
    return null;
  }
  return data?.[0] || null;
};

export const deleteUser = async (id: string) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting user:', error);
    return false;
  }
  return true;
};

// PATIENTS QUERIES
export const fetchPatients = async () => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('date_registered', { ascending: false });
  
  if (error) {
    console.error('Error fetching patients:', error);
    return [];
  }
  return data || [];
};

export const addPatient = async (patient: any) => {
  const { data, error } = await supabase
    .from('patients')
    .insert([patient])
    .select();
  
  if (error) {
    console.error('Error adding patient:', error);
    return null;
  }
  return data?.[0] || null;
};

export const updatePatient = async (id: string, patient: any) => {
  const { data, error } = await supabase
    .from('patients')
    .update(patient)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating patient:', error);
    return null;
  }
  return data?.[0] || null;
};

export const deletePatient = async (id: string) => {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting patient:', error);
    return false;
  }
  return true;
};

// TEST RESULTS QUERIES
export const fetchTestResults = async () => {
  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .order('date_created', { ascending: false });
  
  if (error) {
    console.error('Error fetching test results:', error);
    return [];
  }
  return data || [];
};

export const addTestResult = async (result: any) => {
  const { data, error } = await supabase
    .from('test_results')
    .insert([result])
    .select();
  
  if (error) {
    console.error('Error adding test result:', error);
    return null;
  }
  return data?.[0] || null;
};

export const updateTestResult = async (id: string, result: any) => {
  const { data, error } = await supabase
    .from('test_results')
    .update(result)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating test result:', error);
    return null;
  }
  return data?.[0] || null;
};

export const deleteTestResult = async (id: string) => {
  const { error } = await supabase
    .from('test_results')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting test result:', error);
    return false;
  }
  return true;
};

// AUDIT LOGS QUERIES
export const fetchAuditLogs = async () => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
  return data || [];
};

export const logActivity = async (log: {
  user_id?: string;
  user_name: string;
  encryption_key: string;
  action: 'login' | 'logout' | 'view' | 'edit' | 'delete' | 'download';
  resource: string;
  resource_type: string;
  description: string;
  ip_address?: string;
}) => {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        ...log,
        ip_address: log.ip_address || 'N/A'
      }]);
    
    if (error) {
      console.error('Error logging activity:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error logging activity:', error);
    return false;
  }
};

// REAL-TIME SUBSCRIPTION FOR AUDIT LOGS
export const subscribeToAuditLogs = (callback: (log: any) => void) => {
  const channel = supabase
    .channel('audit_logs_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'audit_logs',
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
