const testFlow = async () => {
    console.log('1. Testing Login against ZTA Gateway (localhost:3002)...');
    try {
        const loginRes = await fetch('http://localhost:3002/api/zta/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'rajesh.kumar', password: 'pass123' })
        });
        
        console.log(`Login Response Status: ${loginRes.status}`);
        const loginData = await loginRes.json();
        if (!loginRes.ok) {
            console.error('Login Failed:', loginData);
            return;
        }
        
        console.log('Login Succeeded. Access Token acquired.');
        const token = loginData.access_token || loginData.token;

        console.log('\n2. Testing dummy banking request via ZTA proxy (localhost:3002)...');
        const statsRes = await fetch('http://localhost:3002/api/banking/treasury/stats', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`Stats Response Status: ${statsRes.status}`);
        const statsData = await statsRes.json();
        console.log('Stats Response Data:', statsData);

    } catch (e) {
        console.error('Test script error:', e);
    }
}

testFlow();
