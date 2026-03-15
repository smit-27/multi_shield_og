export const getRandomAmount = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

export const getRandomItem = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)]
}

export const generateRandomTransactions = (count = 10) => {
  const types = ['withdrawal', 'deposit', 'transfer']
  const descriptions = [
    'Cash withdrawal — Branch 42',
    'Internal transfer to Reserve',
    'RBI settlement credit',
    'Loan disbursement batch',
    'NEFT batch settlement',
    'Emergency cash withdrawal',
    'Bulk deposit processing',
    'Inter-bank transfer',
    'ATM Withdrawal - MG Road',
    'Online Purchase - TechStore',
    'Salary Credit - GlobalCorp',
    'Utility Bill Payment'
  ]
  const statuses = ['completed', 'pending', 'blocked']

  return Array.from({ length: count }, (_, i) => ({
    id: `TX${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    type: getRandomItem(types),
    amount: getRandomAmount(100, 10000000),
    description: getRandomItem(descriptions),
    status: Math.random() > 0.8 ? getRandomItem(statuses) : 'completed',
    created_at: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString().replace('T', ' ').substring(0, 19)
  }))
}

export const generateRandomCustomers = (count = 20) => {
  const firstNames = ['Rajesh', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Anita', 'Ramesh', 'Sanjay', 'Meena', 'Arjun']
  const lastNames = ['Kumar', 'Sharma', 'Patel', 'Reddy', 'Desai', 'Gupta', 'Singh', 'Verma', 'Iyer', 'Joshi']
  const cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad']

  return Array.from({ length: count }, (_, i) => {
    const firstName = getRandomItem(firstNames)
    const lastName = getRandomItem(lastNames)
    const fullName = `${firstName} ${lastName}`
    return {
      id: `CUST${100 + i}`,
      full_name: fullName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      phone: `987654${Math.floor(Math.random() * 9000 + 1000)}`,
      pan: `ABCDE${Math.floor(Math.random() * 9000 + 1000)}F`,
      address: `${getRandomItem(cities)}, India`,
      account_type: Math.random() > 0.5 ? 'savings' : 'current',
      balance: getRandomAmount(1000, 100000000),
      risk_category: getRandomItem(['low', 'medium', 'high']),
      status: 'active'
    }
  })
}

export const generateActivityLogs = (count = 15) => {
  const actions = ['Login', 'Withdrawal', 'Transfer', 'Customer Update', 'KYC Verification', 'Data Export', 'Loan Approval']
  const devices = ['Internal Workstation', 'Admin Terminal', 'Mobile Access', 'Legacy Console']

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    action: getRandomItem(actions),
    details: 'User performed a secure operation on the system.',
    ip_address: `10.0.0.${getRandomAmount(1, 254)}`,
    device: getRandomItem(devices),
    risk_score: getRandomAmount(0, 100),
    decision: Math.random() > 0.9 ? 'BLOCK' : 'ALLOW',
    created_at: new Date(Date.now() - Math.random() * 3600000).toISOString().replace('T', ' ').substring(0, 19)
  }))
}
