const { spawn } = require('child_process');
const axios = require('axios');

console.log('🔄 Restarting server with fixed calendar routes...');

// Function to check if server is running
async function checkServer(port) {
    try {
        const response = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Function to wait for server to stop
async function waitForServerStop(port, maxWaits = 30) {
    for (let i = 0; i < maxWaits; i++) {
        const isRunning = await checkServer(port);
        if (!isRunning) {
            console.log(`✅ Server on port ${port} stopped`);
            return true;
        }
        console.log(`⏳ Waiting for server on port ${port} to stop... (${i + 1}/${maxWaits})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
}

// Function to wait for server to start
async function waitForServerStart(port, maxWaits = 30) {
    for (let i = 0; i < maxWaits; i++) {
        const isRunning = await checkServer(port);
        if (isRunning) {
            console.log(`✅ Server on port ${port} started`);
            return true;
        }
        console.log(`⏳ Waiting for server on port ${port} to start... (${i + 1}/${maxWaits})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
}

async function main() {
    console.log('🏃‍♂️ Starting restart process...');
    
    // Kill any existing node processes (dangerous but necessary for clean restart)
    console.log('🔪 Killing existing node processes...');
    
    try {
        // On Windows, use taskkill to stop node processes
        const killProcess = spawn('cmd', ['/c', 'for /f "tokens=2" %i in (\'netstat -ano ^| findstr :8000 ^| findstr LISTENING\') do taskkill /pid %i /f'], {
            stdio: 'inherit',
            shell: true
        });
        
        await new Promise((resolve) => {
            killProcess.on('close', (code) => {
                console.log(`🔪 Kill process exited with code ${code}`);
                resolve();
            });
        });
        
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Wait for port 8000 to be free
        await waitForServerStop(8000);
        
    } catch (error) {
        console.log('⚠️ Error killing processes, continuing...', error.message);
    }
    
    // Start new server
    console.log('🚀 Starting new server...');
    const serverProcess = spawn('node', ['index.js'], {
        stdio: 'pipe',
        cwd: __dirname
    });
    
    // Handle server output
    serverProcess.stdout.on('data', (data) => {
        console.log(data.toString().trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
        console.error('SERVER ERROR:', data.toString().trim());
    });
    
    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
    });
    
    // Wait for server to start
    const serverStarted = await waitForServerStart(8000);
    
    if (serverStarted) {
        console.log('🎉 Server restarted successfully!');
        console.log('📋 Test: http://localhost:8000/api/calendar/test');
        console.log('🗓️ Events: http://localhost:8000/api/calendar/events');
    } else {
        console.log('❌ Failed to start server');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Restart script interrupted');
    process.exit(0);
});

main().catch(error => {
    console.error('❌ Restart failed:', error);
    process.exit(1);
});