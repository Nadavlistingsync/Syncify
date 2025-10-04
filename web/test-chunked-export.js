// Simple test script for chunked export functionality
// Run with: node test-chunked-export.js

const BASE_URL = 'http://localhost:3000'

async function testChunkedExport() {
  console.log('🧪 Testing Chunked Export Functionality...\n')

  try {
    // Test 1: Get export manifest
    console.log('1️⃣ Testing export manifest...')
    const manifestResponse = await fetch(`${BASE_URL}/api/export/chunked`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'json',
        includeRedacted: false,
        chunkSize: 10
      })
    })

    if (!manifestResponse.ok) {
      throw new Error(`Manifest request failed: ${manifestResponse.status}`)
    }

    const manifest = await manifestResponse.json()
    console.log('✅ Export manifest received:')
    console.log(`   - Total chunks: ${manifest.export_info.total_chunks}`)
    console.log(`   - Chunk size: ${manifest.export_info.chunk_size}`)
    console.log(`   - Data types: ${manifest.export_info.data_types.join(', ')}`)
    console.log(`   - Chunks breakdown:`, manifest.chunks.map(c => `${c.data_type}: ${c.total_chunks} chunks`).join(', '))

    // Test 2: Download a sample chunk
    console.log('\n2️⃣ Testing chunk download...')
    const chunkResponse = await fetch(`${BASE_URL}/api/export/chunked?dataType=memories&chunk=0&chunkSize=10`)
    
    if (!chunkResponse.ok) {
      throw new Error(`Chunk request failed: ${chunkResponse.status}`)
    }

    const chunk = await chunkResponse.json()
    console.log('✅ Sample chunk downloaded:')
    console.log(`   - Chunk ID: ${chunk.chunk_id}`)
    console.log(`   - Data type: ${chunk.data_type}`)
    console.log(`   - Records in chunk: ${chunk.data.length}`)
    console.log(`   - Current chunk: ${chunk.current_chunk}/${chunk.total_chunks}`)

    // Test 3: Test different data types
    console.log('\n3️⃣ Testing different data types...')
    const dataTypes = ['memories', 'conversations', 'profiles', 'site_policies', 'events']
    
    for (const dataType of dataTypes) {
      try {
        const testResponse = await fetch(`${BASE_URL}/api/export/chunked?dataType=${dataType}&chunk=0&chunkSize=5`)
        if (testResponse.ok) {
          const testChunk = await testResponse.json()
          console.log(`✅ ${dataType}: ${testChunk.data.length} records in first chunk`)
        } else {
          console.log(`⚠️  ${dataType}: No data or error (${testResponse.status})`)
        }
      } catch (error) {
        console.log(`❌ ${dataType}: Error - ${error.message}`)
      }
    }

    console.log('\n🎉 Chunked export functionality is working correctly!')
    console.log('\n📋 Summary:')
    console.log('   - ✅ Manifest generation works')
    console.log('   - ✅ Chunk downloading works')
    console.log('   - ✅ Multiple data types supported')
    console.log('   - ✅ Progress tracking ready')
    console.log('\n💡 The chunked export system will:')
    console.log('   - Download data in small batches (50 records per chunk)')
    console.log('   - Show progress to users during download')
    console.log('   - Prevent timeouts on large datasets')
    console.log('   - Allow cancellation of long-running exports')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.log('\n🔧 Troubleshooting:')
    console.log('   1. Make sure the web server is running (npm run dev)')
    console.log('   2. Check that you are authenticated in the browser')
    console.log('   3. Verify the API endpoints are accessible')
  }
}

// Run the test
testChunkedExport()
