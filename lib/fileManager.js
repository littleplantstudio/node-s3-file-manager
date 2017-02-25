var fs = require('co-fs');
var co = require('co');
var fse = require('co-fs-extra');
var path = require('path');
var JSZip = require('jszip');

var config = require('./config');
var S3 = require('co-s3');
var s3 = new S3({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});

var FileManager = {};

FileManager.list = function *(dirPath) {
    if(dirPath === '.')
        dirPath = dirPath === '.'?'':dirPath;
    console.log(dirPath);
    
    var data = yield s3.listObjects({Bucket:config.AWS_S3_BUCKET_NAME, Delimiter:'/', Prefix:dirPath});
    var stats = [];
    for (var i=0; i<data.CommonPrefixes.length; ++i) {
        var name = data.CommonPrefixes[i].Prefix;
        var folders = name.split('/');
        if(folders.length  >= 2)
            name = folders[folders.length - 2];
        stats.push({
            name: name,
            folder: true,
            size: 0,
            mtime: 0
        });
    }
    for (var i=0; i<data.Contents.length; ++i) {
        var file = data.Contents[i];
        if(file.Size > 0){
            stats.push({
                name: file.Key.substr(file.Key.lastIndexOf('/') + 1),
                folder: false,
                size: file.Size,
                mtime: new Date(file.LastModified).getTime()
            });
        }

    }
    return stats;
};

FileManager.add = function *(dirPath, body) {
    yield s3.upload({Bucket:config.AWS_S3_BUCKET_NAME, Key: 'tmp/' + newname, Body: body});
};

FileManager.mkdirs = function *(dirPath) {
    dirPath = dirPath + '/';
    var data = yield s3.putObject({Bucket:config.AWS_S3_BUCKET_NAME, Key:dirPath});
};

FileManager.remove = function *(p) {
    var bucket = config.AWS_S3_BUCKET_NAME;
    var list = yield s3.listObjects({Bucket:bucket, Delimiter:'/', Prefix:p});
    var params = {Bucket:bucket};
    params.Delete = {Objects:[]};
    for(var i=0; i<list.Contents.length; i++){
        var content = list.Contents[i];
        yield s3.deleteObject({Bucket:config.AWS_S3_BUCKET_NAME, Key: content.Key});
    }
};

FileManager.move = function *(srcs, dest) {
    //TODO:
};

FileManager.rename = function *(src, dest) {
    //TODO:
};

FileManager.archive = function *(dirPath, archive, src, embedDirs) {
    //TODO:
    var zip = new JSZip();
    var baseName = path.basename(archive, '.zip');

    function* addFile(file) {
        var data = yield fs.readFile(file);
        var name;
        if (embedDirs) {
            name = file;
            if (name.indexOf(dirPath) === 0) {
                name = name.substring(dirPath.length);
            }
        } else {
            name = path.basename(file);
        }
        zip.file(name, data);
        C.logger.info('Added ' + name + ' ' + data.length + ' bytes to archive ' + archive);
    }

    function* addDir(dir) {
        var contents = yield fs.readdir(dir);
        for (var file of contents) {
            yield * process(path.join(dir, file));
        }
    }

    function* process(fp) {
        var stat = yield fs.stat(fp);
        if (stat.isDirectory()) {
            yield * addDir(fp);
        } else {
            yield addFile(fp);
        }
    }

    // Add each src.  For directories, do the entire recursive dir.
    for (var file of src) {
        yield * process(path.join(dirPath, file.replace(/^\//, '')));
    }

    // Generate the zip and store the final.
    var data = yield zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
    yield fs.writeFile(archive, data, 'binary');
};

module.exports = FileManager;
