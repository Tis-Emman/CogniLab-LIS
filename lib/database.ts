import { supabase } from './supabaseClient';
import { MOCK_USERS, MOCK_PATIENTS, MOCK_TEST_RESULTS, MOCK_BILLING, MOCK_AUDIT_LOGS, TEST_PRICING, TEST_REFERENCE_RANGES } from './mockData';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// USERS QUERIES
export const fetchUsers = async () => {
  if (USE_MOCK_DATA) {
    console.log('📦 Using MOCK data for users');
    return MOCK_USERS;
  }
  
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
  if (USE_MOCK_DATA) {
    console.log('📦 Using MOCK data for patients');
    return MOCK_PATIENTS;
  }
  
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

export const addPatient = async (patient: any, currentUser?: any) => {
  if (USE_MOCK_DATA) {
    // Generate a unique ID for the new patient
    const newPatient = {
      id: `pat-${Date.now()}`,
      ...patient,
      date_registered: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Add to mock data (in-memory)
    MOCK_PATIENTS.push(newPatient);
    
    // Create billing record for patient registration
    const patientName = `${patient.first_name} ${patient.last_name}`;
    await addBilling({
      patient_name: patientName,
      test_name: 'Patient Registration/Consultation',
      section: 'REGISTRATION',
      amount: 150,
      description: `Initial consultation fee for ${patientName}`,
    });
    
    // Log the action
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || 'Unknown User',
      encryption_key: currentUser?.encryption_key || '',
      action: 'edit',
      resource: `${patient.patient_id_no} - ${patient.first_name} ${patient.last_name}`,
      resource_type: 'Patient',
      description: `Created new patient record: ${patient.first_name} ${patient.last_name} (Patient ID: ${patient.patient_id_no})`,
    });
    
    return newPatient;
  }

  const { data, error } = await supabase
    .from('patients')
    .insert([patient])
    .select();
  
  if (error) {
    console.error('Error adding patient:', error);
    return null;
  }

  // Create billing record for patient registration
  if (data?.[0]) {
    const patientName = `${patient.first_name} ${patient.last_name}`;
    await addBilling({
      patient_name: patientName,
      test_name: 'Patient Registration/Consultation',
      section: 'REGISTRATION',
      amount: 150,
      description: `Initial consultation fee for ${patientName}`,
    });
    
    // Log the action
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || 'Unknown User',
      encryption_key: currentUser?.encryption_key || '',
      action: 'edit',
      resource: `${patient.patient_id_no} - ${patient.first_name} ${patient.last_name}`,
      resource_type: 'Patient',
      description: `Created new patient record: ${patient.first_name} ${patient.last_name} (Patient ID: ${patient.patient_id_no})`,
    });
  }

  return data?.[0] || null;
};

export const updatePatient = async (id: string, patient: any) => {
  if (USE_MOCK_DATA) {
    const index = MOCK_PATIENTS.findIndex(p => p.id === id);
    if (index !== -1) {
      MOCK_PATIENTS[index] = { ...MOCK_PATIENTS[index], ...patient, updated_at: new Date().toISOString() };
      return MOCK_PATIENTS[index];
    }
    return null;
  }

  const { data, error } = await supabase
    .from('patients')
    .update(patient)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating patient:', error);
    return null;
  }
  
  if (data?.[0]) {
    await logActivity({
      user_name: 'Current User',
      encryption_key: 'ENC_KEY_TEMP',
      action: 'edit',
      resource: `${data[0].patient_id_no} - ${data[0].first_name} ${data[0].last_name}`,
      resource_type: 'Patient',
      description: `Updated patient record: ${data[0].first_name} ${data[0].last_name} (Patient ID: ${data[0].patient_id_no})`,
    });
  }
  
  return data?.[0] || null;
};

export const deletePatient = async (id: string) => {
  if (USE_MOCK_DATA) {
    const index = MOCK_PATIENTS.findIndex(p => p.id === id);
    if (index !== -1) {
      const deletedPatient = MOCK_PATIENTS[index];
      MOCK_PATIENTS.splice(index, 1);
      
      await logActivity({
        user_name: 'Current User',
        encryption_key: 'ENC_KEY_TEMP',
        action: 'delete',
        resource: `${deletedPatient.patient_id_no} - ${deletedPatient.first_name} ${deletedPatient.last_name}`,
        resource_type: 'Patient',
        description: `Deleted patient record: ${deletedPatient.first_name} ${deletedPatient.last_name} (Patient ID: ${deletedPatient.patient_id_no})`,
      });
      
      return true;
    }
    return false;
  }

  // Get patient data before deletion for logging
  const { data: patientData } = await supabase
    .from('patients')
    .select('patient_id_no, first_name, last_name')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting patient:', error);
    return false;
  }
  
  if (patientData) {
    await logActivity({
      user_name: 'Current User',
      encryption_key: 'ENC_KEY_TEMP',
      action: 'delete',
      resource: `${patientData.patient_id_no} - ${patientData.first_name} ${patientData.last_name}`,
      resource_type: 'Patient',
      description: `Deleted patient record: ${patientData.first_name} ${patientData.last_name} (Patient ID: ${patientData.patient_id_no})`,
    });
  }
  
  return true;
};

// TEST RESULTS QUERIES
export const fetchTestResults = async () => {
  if (USE_MOCK_DATA) {
    console.log('📦 Using MOCK data for test results');
    return MOCK_TEST_RESULTS;
  }
  
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

// Tests whose components are billed as a single parent test (e.g. CBC components → one CBC billing)
const BILLING_PARENT_TESTS: Record<string, string[]> = {
  HEMATOLOGY: ['Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils'], // CBC components
  'CLINICAL MICROSCOPY': ['UA Color', 'UA Transparency', 'UA pH', 'UA Protein/Glucose', 'UA Bilirubin/Ketone', 'UA Urobilinogen', 'UA WBC (Microscopic)', 'UA RBC (Microscopic)', 'UA Bacteria/Casts/Crystals'], // Routine Urinalysis
  MICROBIOLOGY: ['Culture', 'Preliminary Report', 'Final Report', 'Sensitivity (Antibiogram)'], // Culture and Sensitivity
};
const BILLING_PARENT_NAMES: Record<string, string> = {
  HEMATOLOGY: 'CBC',
  'CLINICAL MICROSCOPY': 'Routine Urinalysis (UA)',
  MICROBIOLOGY: 'Culture and Sensitivity',
};

export const addTestResult = async (result: any, currentUser?: any, skipBilling?: boolean) => {
  if (USE_MOCK_DATA) {
    const newResult = {
      id: `result-${Date.now()}`,
      ...result,
      status: result.status || 'pending',
      date_created: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_TEST_RESULTS.push(newResult);

    // Skip billing for component tests - caller will add single parent billing
    const isComponent = BILLING_PARENT_TESTS[result.section]?.includes(result.test_name);
    if (skipBilling || isComponent) {
      await logActivity({
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || 'Unknown User',
        encryption_key: currentUser?.encryption_key || '',
        action: 'edit',
        resource: `${result.test_name} - ${result.patient_name}`,
        resource_type: 'Test Result',
        description: `Created test result: ${result.test_name} for patient ${result.patient_name} in section ${result.section}${isComponent ? ' (component of ' + (BILLING_PARENT_NAMES[result.section] || 'parent test') + ')' : ''}`,
      });
      return newResult;
    }

    // Automatically create billing entry for the test
    const testCost = TEST_PRICING[result.section]?.[result.test_name] || 300;
    const billingEntry = {
      id: `billing-${Date.now()}`,
      patient_name: result.patient_name,
      test_name: result.test_name,
      section: result.section,
      amount: testCost,
      status: 'unpaid',
      date_created: new Date().toISOString().split('T')[0],
      description: `Lab test: ${result.test_name}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_BILLING.push(billingEntry);

    // Log the action
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || 'Unknown User',
      encryption_key: currentUser?.encryption_key || '',
      action: 'edit',
      resource: `${result.test_name} - ${result.patient_name}`,
      resource_type: 'Test Result',
      description: `Created test result: ${result.test_name} for patient ${result.patient_name} in section ${result.section}. Auto-billed: ₱${testCost.toFixed(2)}`,
    });

    return newResult;
  }

  const { data, error } = await supabase
    .from('test_results')
    .insert([result])
    .select();
  
  if (error) {
    console.error('Error adding test result:', error);
    return null;
  }

  if (data?.[0]) {
    // Log the action
    const testCost = TEST_PRICING[result.section]?.[result.test_name] || 300;
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || 'Unknown User',
      encryption_key: currentUser?.encryption_key || '',
      action: 'edit',
      resource: `${result.test_name} - ${result.patient_name}`,
      resource_type: 'Test Result',
      description: `Created test result: ${result.test_name} for patient ${result.patient_name} in section ${result.section}. Auto-billed: ₱${testCost.toFixed(2)}`,
    });
  }

  return data?.[0] || null;
};

export const updateTestResult = async (id: string, result: any, currentUser?: any) => {
  if (USE_MOCK_DATA) {
    const index = MOCK_TEST_RESULTS.findIndex(r => r.id === id);
    if (index !== -1) {
      const oldStatus = MOCK_TEST_RESULTS[index].status;
      MOCK_TEST_RESULTS[index] = { ...MOCK_TEST_RESULTS[index], ...result, updated_at: new Date().toISOString() };
      
      // Log status change if it occurred
      if (result.status && result.status !== oldStatus) {
        await logActivity({
          user_id: currentUser?.id,
          user_name: currentUser?.full_name || 'Unknown User',
          encryption_key: currentUser?.encryption_key || '',
          action: 'edit',
          resource: `${MOCK_TEST_RESULTS[index].test_name} - ${MOCK_TEST_RESULTS[index].patient_name}`,
          resource_type: 'Test Result',
          description: `Updated test status: ${oldStatus.toUpperCase()} → ${result.status.toUpperCase()} for ${MOCK_TEST_RESULTS[index].test_name}`,
        });
      }
      
      return MOCK_TEST_RESULTS[index];
    }
    return null;
  }

  const { data: oldData } = await supabase
    .from('test_results')
    .select('*')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('test_results')
    .update(result)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating test result:', error);
    return null;
  }

  // Log status change if it occurred
  if (data?.[0] && result.status && result.status !== oldData?.status) {
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || 'Unknown User',
      encryption_key: currentUser?.encryption_key || '',
      action: 'edit',
      resource: `${data[0].test_name} - ${data[0].patient_name}`,
      resource_type: 'Test Result',
      description: `Updated test status: ${oldData?.status.toUpperCase()} → ${result.status.toUpperCase()} for ${data[0].test_name}`,
    });
  }

  return data?.[0] || null;
};

export const deleteTestResult = async (id: string) => {
  if (USE_MOCK_DATA) {
    const index = MOCK_TEST_RESULTS.findIndex(r => r.id === id);
    if (index !== -1) {
      MOCK_TEST_RESULTS.splice(index, 1);
      return true;
    }
    return false;
  }

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

// BILLING QUERIES
export const fetchBilling = async () => {
  if (USE_MOCK_DATA) {
    console.log('📦 Using MOCK data for billing');
    return MOCK_BILLING;
  }
  
  const { data, error } = await supabase
    .from('billing')
    .select('*')
    .order('date_created', { ascending: false });
  
  if (error) {
    console.error('Error fetching billing:', error);
    return [];
  }
  return data || [];
};

export const addBilling = async (billing: {
  patient_name: string;
  test_name: string;
  section: string;
  amount: number;
  description?: string;
}) => {
  if (USE_MOCK_DATA) {
    const newBilling = {
      id: `billing-${Date.now()}`,
      patient_name: billing.patient_name,
      test_name: billing.test_name,
      section: billing.section,
      amount: billing.amount,
      status: 'unpaid' as const,
      description: billing.description || `${billing.test_name} - ${billing.section}`,
      date_created: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_BILLING.push(newBilling);
    return newBilling;
  }

  const { data, error } = await supabase
    .from('billing')
    .insert([
      {
        patient_name: billing.patient_name,
        test_name: billing.test_name,
        section: billing.section,
        amount: billing.amount,
        description: billing.description || `${billing.test_name} - ${billing.section}`,
        status: 'unpaid',
      },
    ])
    .select();

  if (error) {
    console.error('Error adding billing:', error);
    return null;
  }
  return data?.[0] || null;
};

export const updateBillingStatus = async (id: string, status: 'paid' | 'unpaid', currentUser?: any) => {
  if (USE_MOCK_DATA) {
    const index = MOCK_BILLING.findIndex(b => b.id === id);
    if (index !== -1) {
      const oldStatus = MOCK_BILLING[index].status;
      MOCK_BILLING[index] = { ...MOCK_BILLING[index], status, updated_at: new Date().toISOString() };
      
      // Log the action
      await logActivity({
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || 'Unknown User',
        encryption_key: currentUser?.encryption_key || '',
        action: 'edit',
        resource: `${MOCK_BILLING[index].test_name} - ${MOCK_BILLING[index].patient_name}`,
        resource_type: 'Billing',
        description: `Updated billing status: ${oldStatus.toUpperCase()} → ${status.toUpperCase()} for ${MOCK_BILLING[index].test_name}. Amount: ₱${MOCK_BILLING[index].amount.toFixed(2)}`,
      });
      
      return MOCK_BILLING[index];
    }
    return null;
  }

  const { data: oldData } = await supabase
    .from('billing')
    .select('*')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('billing')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating billing status:', error);
    return null;
  }

  // Log the action
  if (data?.[0]) {
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || 'Unknown User',
      encryption_key: currentUser?.encryption_key || '',
      action: 'edit',
      resource: `${data[0].test_name} - ${data[0].patient_name}`,
      resource_type: 'Billing',
      description: `Updated billing status: ${oldData?.status.toUpperCase()} → ${status.toUpperCase()} for ${data[0].test_name}. Amount: ₱${data[0].amount.toFixed(2)}`,
    });
  }

  return data?.[0] || null;
};

export const deleteBilling = async (id: string) => {
  if (USE_MOCK_DATA) {
    const index = MOCK_BILLING.findIndex(b => b.id === id);
    if (index !== -1) {
      MOCK_BILLING.splice(index, 1);
      return true;
    }
    return false;
  }

  const { error } = await supabase
    .from('billing')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting billing:', error);
    return false;
  }
  return true;
};

// AUDIT LOGS QUERIES
export const fetchAuditLogs = async () => {
  if (USE_MOCK_DATA) {
    console.log('📦 Using MOCK data for audit logs');
    return MOCK_AUDIT_LOGS;
  }
  
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
    if (USE_MOCK_DATA) {
      const newLog: any = {
        id: `log-${Date.now()}`,
        user_id: log.user_id || 'user-temp',
        user_name: log.user_name,
        encryption_key: log.encryption_key,
        action: log.action,
        resource: log.resource,
        resource_type: log.resource_type,
        description: log.description,
        ip_address: log.ip_address || '',
        created_at: new Date().toISOString(),
      };
      MOCK_AUDIT_LOGS.push(newLog);
      return true;
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        ...log,
        ip_address: log.ip_address || ''
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

// UTILITY FUNCTIONS FOR RESULTS
export const getAbnormalStatus = (value: string | number, testName: string, section: string): 'normal' | 'high' | 'low' => {
  const ranges = TEST_REFERENCE_RANGES[section]?.[testName];
  if (!ranges) return 'normal';

  // If it's a normal text value (Negative, Positive, etc.)
  if (typeof value === 'string' && (value.toLowerCase() === 'negative' || value.toLowerCase() === 'no growth' || value === 'Compatible')) {
    return 'normal';
  }

  const numValue = Number(value);
  if (isNaN(numValue)) return 'normal';

  // Check against min/max
  if (ranges.min !== undefined && numValue < ranges.min) return 'low';
  if (ranges.max !== undefined && numValue > ranges.max) return 'high';
  
  return 'normal';
};

export const getTestPrice = (testName: string, section: string): number | null => {
  return TEST_PRICING[section]?.[testName] || null;
};

export const enrichTestResultWithBilling = (result: any, billings: any[] = []) => {
  // CBC/components: use parent test for pricing and billing lookup
  const isComponent = BILLING_PARENT_TESTS[result.section]?.includes(result.test_name);
  const billingTestName = isComponent ? (BILLING_PARENT_NAMES[result.section] || result.test_name) : result.test_name;
  const price = getTestPrice(billingTestName, result.section);
  const billing = billings.find(b => 
    b.test_name === billingTestName && 
    b.patient_name === result.patient_name
  );
  const abnormal = getAbnormalStatus(result.result_value, result.test_name, result.section);
  
  return {
    ...result,
    price,
    paymentStatus: billing?.status || 'unpaid',
    abnormal,
  };
};

