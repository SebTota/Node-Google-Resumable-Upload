const got           = require('got');
const fs            = require('fs')
const mime          = require('mime')
const EventEmitter	= require('events').EventEmitter;
const util          = require('util')

function UploadFile() {
    this.sentBytes = 0;
    this.host	= 'www.googleapis.com';
    this.tokens = {};
    this.filePath = '';
    this.metadataBody = {};
    this.apiService = '/upload/drive/v3/files';
    this.retry = 0;
    this.refreshToken = false;
    this.clientId = '';
    this.clientSecret = '';
    this.chunkSize = 1024 * 1024 * 8; // Default chunk size: 8MB (estimate of 8MiB as recommended by Google)
    this.optionalParams = {};
}

util.inherits(UploadFile, EventEmitter);

/*
* Serialize an dictionary into a URL encoded string. The return string will be preceded with an '&'.
* @params   {dictionary}    obj A dictionary of url parameters and values
* @return   {string}            A URL encoded string starting with '&' if there are any key value pairs or an empty string if not
 */
function serializeUrl(obj) {
    let str = [];
    for(let p in obj)
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    if (str.length > 0)
        return `&${str.join("&")}`;
    return ''
}

/*
* Refresh Google OAuth Access Token using Refresh Token
 */
UploadFile.prototype.refreshAccessToken = async function() {
    const refreshUrl = `https://www.googleapis.com/oauth2/v4/token?client_id=${this.clientId}&client_secret=${this.clientSecret}&refresh_token=${this.tokens.refresh_token}&grant_type=refresh_token`;
    try {
        const res = await got.post(refreshUrl);
        // Update refreshed access_token
        this.emit('progress', 'Updating access token');
        if (res.hasOwnProperty('body') && JSON.parse(res.body).hasOwnProperty('access_token')) {
            this.tokens.access_token = JSON.parse(res.body)['access_token'];
        }
        this.emit('progress', `New access token: ${this.tokens.access_token}`)
    } catch(e) {
        this.emit('error', new Error(e))
    }
}

UploadFile.prototype.upload = async function() {
    this.fileSize = fs.statSync(this.filePath).size;
    this.mimeType = mime.getType(this.filePath) === null ? 'application/octet-stream' : mime.getType(this.filePath)
    var options = {
        url:	`https://${this.host}${this.apiService}?uploadType=resumable&part=snippet,status,contentDetails${serializeUrl(this.optionalParams)}`,
        headers: {
            'Host'                      :   this.host,
            'Authorization'             :   'Bearer ' + this.tokens.access_token,
            'Content-Length'            :   new Buffer.from(JSON.stringify(this.metadataBody)).length,
            'Content-Type'              :   'application/json; charset=UTF-8',
            'X-Upload-Content-Length'   :   this.fileSize,
            'X-Upload-Content-Type'     : 	this.mimeType
        },
        body: JSON.stringify(this.metadataBody)
    };

    let res;
    let err;
    try {
        res = await got.post(options)
    } catch(e) {
        if (e.response.statusCode === 401 && this.refreshToken === true) {
            this.refreshToken = false; // Only try to refresh the token once
            await this.refreshAccessToken(); // Refresh access token
            await this.upload(); // Retry upload
            return;
        } else {
            this.emit('error', new Error(e))
        }
    }

    /*
    * Retry upload depending on retry counter or continue to upload file if no error
     */
    if(err || !res.headers.location) {
        if ((this.retry > 0) || (this.retry <= -1)) {
            this.retry--;
            await this.upload(); // Retry initiating upload
        }
    } else {
        this.location = res.headers.location;
        await this.send();
    }
}

UploadFile.prototype.send = async function() {
    while(this.sentBytes < this.fileSize) {
        let startByte = this.sentBytes;
        let bytesToSend = this.chunkSize;

        // Check to make sure the number of bytes to send is less than or equal to the number of bytes left
        if (this.fileSize - this.sentBytes < bytesToSend) {
            // Not enough bytes to send an entire chunk.
            // Set size to the amount of bytes left to send
            bytesToSend = this.fileSize - this.sentBytes;
        }
        let endByte = startByte + bytesToSend;

        let uploadPipe = fs.createReadStream(this.filePath, {
            start: startByte,
            end: endByte
        });

        let options = {
            url: this.location,
            headers: {
                'Authorization' :   'Bearer ' + this.tokens.access_token,
                'Content-Length':	bytesToSend,
                'Content-Type'  :	this.mimeType,
                'Content-Range' :   `bytes ${startByte}-${endByte-1}/${this.fileSize}`
            },
            body: uploadPipe
        };

        let res;
        try {
            res = await got.put(options);
        } catch (e) {
            /*
             * Check if error being thrown is due to status code 308
             * Status code 308 is an expected code in this application asking the user to resume the upload
             */
            if (e.response.statusCode === 308) {
                res = e
            } else {
                this.emit('error', new Error(e))
            }
        }

        if (res.hasOwnProperty('body')) {
            this.emit('success', JSON.parse(res.body))
            break;
        }

        if (res.response.hasOwnProperty('statusCode') && res.response.statusCode === 308 && res.response.headers.hasOwnProperty('range')) {
            this.sentBytes = Number(res.response.headers.range.split('-').pop());
            this.emit('progress', `Bytes sent: ${this.sentBytes}`)
        } else {
            if ((this.retry > 0) || (this.retry <= -1)) {
                this.retry--;
                this.emit('progress', 'Retrying')
                await this.send(); // Retry initiating upload
            } else {
                this.emit('error', "Exiting upload")
            }
        }
    }
}

module.exports = UploadFile;