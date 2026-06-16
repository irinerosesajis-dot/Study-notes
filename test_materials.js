const http = require('http');

http.get('http://localhost:5000/api/materials', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Materials count:', parsed.count);
      if (parsed.materials && parsed.materials.length > 0) {
        const id = parsed.materials[0]._id;
        console.log('Testing download for:', id, parsed.materials[0].title);
        
        // Use token if needed? Wait, the route is protected!
        console.log('Cannot test download without auth token.');
      }
    } catch(e) {
      console.log('Error:', e.message);
    }
  });
}).on('error', err => {
  console.log('Req error:', err.message);
});
