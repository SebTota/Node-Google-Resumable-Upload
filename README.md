# Node.js - Google Resumable Upload
Allows users to upload files or any size to various Google services using the 
resumable upload API.

## Usage
### Install
```bash
npm i node-google-resumable-upload
```

### Tokens
This application does not get the required Google OAuth tokens, however 
the token can be refreshed if the `refreshToken` value is set to `true`
and the `clientId` and `clientSecret` values are set.

### Uploading A Single File (Google Drive)
```javascript
const UploadFile = require('node-google-resumable-upload')
let uploadFile = new UploadFile();
uploadFile.tokens = token; // OAuth token
uploadFile.filePath = 'path/To/File';
uploadFile.metadataBody = {
    name: 'file name',
    parents: ['parentsFolderId']
}
uploadFile.refreshToken = true; // Optional: Refreshed expired access token
uploadFile.clientId = ''; // Required if refreshToken = true. 
uploadFile.clientSecret = ''; // Required if refreshToken = true. 
uploadFile.upload(); // Initalize upload

uploadFile.on('error', (e) => {
    console.log(e)
})
    
/*
* Tracks progress of file upload. Based on chunk size, not time.
 */
uploadFile.on('progress', (p) => {
    console.log(p)
})

/*
* Returns the body of the final upload.
 */
uploadFile.on('success', (s) => {
    console.log(s)
    
    /*
    * Ex return when uploading image file to Google Drive
     */
    s = {
        kind: 'drive#file',
        id: 'abc123',
        name: 'file name',
        mimeType: 'image/jpeg'
    }
})
```

### Uploading Multiple Files (Google Drive)
```javascript
const UploadFile = require('node-google-resumable-upload')
let files = ['/Users/user1/path/to/file1', '/Users/user1/path/to/file2']

files.forEach((file) => {
    let uploadFile = new UploadFile();
    uploadFile.tokens = token; // OAuth token
    uploadFile.metadataBody = {
        name: file.split('/').pop() 
    }
    uploadFile.refreshToken = true;
    uploadFile.clientId = '...';
    uploadFile.clientSecret = '...'
    uploadFile.filePath = file
    uploadFile.upload();

    uploadFile.on('error', (e) => {
        console.log(`File ${file} error: ${e}`)
    })

    uploadFile.on('progress', (p) => {
        console.log(`File ${file} progress: ${p}`)
    })

    uploadFile.on('success', (s) => {
        console.log(s)
    })
})
```

### Available Parameters
```javascript
sentBytes = 0;
host	= 'www.googleapis.com'; // Should rarely change
tokens = {}; // OAuth Token
filePath = ''; // Local path of file
metadataBody = {}; // Dictionary containing file metadata
apiService = '/upload/drive/v3/files'; // Indicate which Google Service to use
retry = 0; // Number of retries when upload fails
refreshToken = false; // Indicate if the application should try to refresh the access token if it expired
clientId = ''; // Required if refreshToken = true
clientSecret = ''; // Require if refreshToken = true
chunkSize = 1024 * 1024 * 8; // Default chunk size: 8MB (estimate of 8MiB as recommended by Google)
this.optionalParams = {}; // Additional optional url params
```

## Attribution
This project was inspired by [node-youtube-resumable-upload](https://github.com/grayleonard/node-youtube-resumable-upload).

```
Copyright (c) 2014, Luther Blissett

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```