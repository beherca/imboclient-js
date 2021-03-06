var assert    = require('assert')
  , nock      = require('nock')
  , should    = require('should')
  , fs        = require('fs')
  , Imbo      = require('../../')
  , errServer = require('../servers').createResetServer()
  , stcServer = require('../servers').createStaticServer()
  , fixtures  = __dirname + '/../fixtures'
  , catMd5    = '61da9892205a0d5077a353eb3487e8c8';


var signatureCleaner = function(path) {
    return path.replace(/timestamp=[^&]*&?/, '')
               .replace(/signature=[^&]*&?/, '')
               .replace(/accessToken=[^&]*&?/, '')
               .replace(/\?$/g, '');
};

var bodyCleaner = function() {
    return '*';
};

var client, errClient, mock, stcUrl = 'http://localhost:6775';

describe('ImboClient', function() {
    before(function() {
        client = new Imbo.Client(['http://imbo', 'http://imbo1', 'http://imbo2'], 'pub', 'priv');
        errClient = new Imbo.Client('http://localhost:6776', 'pub', 'priv');
    });

    beforeEach(function() {
        mock = nock('http://imbo');
    });

    afterEach(function() {
        mock.done();
    });


    describe('#getImageIdentifier', function() {
        it('should return an error if file does not exist', function(done) {
            var filename = __dirname + '/does-not-exist.jpg';
            client.getImageIdentifier(filename, function(err) {
                assert.equal('File does not exist (' + filename + ')', err);
                done();
            });
        });

        it('should generate correct md5sum for a file that exists', function(done) {
            client.getImageIdentifier(fixtures + '/cat.jpg', function(err, identifier) {
                assert.ifError(err, 'getImageIdentifier should not give an error on success');
                assert.equal(catMd5, identifier);
                done();
            });
        });
    });

    describe('#getImageIdentifierFromArrayBuffer', function() {
        it('should generate correct md5sum for a normal text string', function(done) {
            client.getImageIdentifierFromArrayBuffer('pliney-the-elder', function(err, identifier) {
                assert.ifError(err, 'getImageIdentifierFromArrayBuffer should not give an error on success');
                assert.equal('f755bd139f9026604d4bdd31bf6ee50e', identifier);
                done();
            });
        });

        it('should generate correct md5sum for a buffer', function(done) {
            var content = fs.readFileSync(fixtures + '/cat.jpg');
            client.getImageIdentifierFromArrayBuffer(content, function(err, identifier) {
                assert.ifError(err, 'getImageIdentifierFromArrayBuffer should not give an error on success');
                assert.equal(catMd5, identifier);
                done();
            });
        });
    });

    describe('#getImageUrl', function() {
        it('should return a ImboUrl-instance', function() {
            var url = client.getImageUrl(catMd5);
            assert.equal(true, url instanceof Imbo.Url, 'getImageUrl did not return instance of ImboUrl');
        });

        it('should return something containing the image identifier', function() {
            var url = client.getImageUrl(catMd5).toString();
            assert.equal(true, url.indexOf(catMd5) > 0, url + ' did not contain ' + catMd5);
        });
    });

    describe('#getImagesUrl', function() {
        it('should return a ImboUrl-instance', function() {
            var url = client.getImagesUrl();
            assert.equal(true, url instanceof Imbo.Url, 'getImagesUrl did not return instance of ImboUrl');
        });

        it('should return the expected URL-string', function() {
            var url = client.getImagesUrl().toString();
            assert.equal('http://imbo/users/pub/images?accessToken=8b3a122984a9200c9d1a9cfa9f377aa2977e077b07398dc6c4bf574afabff851', url);
        });
    });

    describe('#getUserUrl', function() {
        it('should return a ImboUrl-instance', function() {
            var url = client.getUserUrl();
            assert.equal(true, url instanceof Imbo.Url, 'getUserUrl did not return instance of ImboUrl');
        });

        it('should return the expected URL-string', function() {
            var url = client.getUserUrl().toString();
            assert.equal('http://imbo/users/pub?accessToken=49d61296bd039ea36cb74597fb8ac51857f7fa8e77a42e72630cf03974abd2be', url);
        });
    });

    describe('#getResourceUrl', function() {
        it('should return a ImboUrl-instance', function() {
            var url = client.getResourceUrl('resource', 'path', 'page=2&limit=3');
            assert.equal(true, url instanceof Imbo.Url, 'getUserUrl did not return instance of ImboUrl');
        });

        it('should return the expected URL-string', function() {
            var url = client.getResourceUrl('resource', 'path', 'page=2&limit=3').toString();
            url.should.include('http://imbo/users/pub/images/resourcepath?page=2&limit=3&accessToken');
        });
    });

    describe('#generateSignature', function() {
        it('should generate a valid signature', function() {
            var sig;
            sig = client.generateSignature('GET', '/images', '2012-10-11T15:10:17Z');
            assert.equal(sig, 'fd16a910040350f12df83b2e077aa2afdcd0f4d262e69eb84d3ad3ee1e5a243c');

            sig = client.generateSignature('PUT', '/images/' + catMd5, '2012-10-03T12:43:37Z');
            assert.equal(sig, '76ae720ada115f6425f2496c8cf38470f90d302fefd6269205efd53695135aac');
        });
    });

    describe('#getSignedResourceUrl', function() {
        it('should generate a valid, signed resource url', function() {
            var url = client.getSignedResourceUrl('PUT', '/images/' + catMd5, new Date(1349268217000));
            assert.equal(url, '/images/' + catMd5 + '?signature=76ae720ada115f6425f2496c8cf38470f90d302fefd6269205efd53695135aac&timestamp=2012-10-03T12%3A43%3A37Z');
        });
    });

    describe('#getHostForImageIdentifier', function() {
        it('should return the same host for the same image identifiers every time', function() {
            for (var i = 0; i < 10; i++) {
                assert.equal('http://imbo1', client.getHostForImageIdentifier('61ca9892205a0d5077a353eb3487e8c8'));
                assert.equal('http://imbo2', client.getHostForImageIdentifier('3b71c51547c3aa1ae81a5e9c57dfef67'));
                assert.equal('http://imbo',  client.getHostForImageIdentifier('3faab4bb128b56bd7d7e977164b3cc7f'));
                assert.equal('http://imbo1', client.getHostForImageIdentifier('61ca9892205a0d5077a353eb3487e8c8'));
            }
        });
    });

    describe('#parseUrls()', function() {
        it('should handle being passed a server-string', function() {
            var urls = client.parseUrls('http://imbo');
            assert.equal(1, urls.length);
            assert.equal('http://imbo', urls[0]);
        });

        it('should handle being passed an array', function() {
            var hosts = ['http://imbo01', 'http://imbo02', 'http://imbo03'];
            var urls = client.parseUrls(hosts), host = hosts.length;
            assert.equal(3, urls.length);

            while (host--) {
                assert.equal(hosts[host], urls[host]);
            }
        });

        it('should strip trailing slashes', function() {
            assert.equal('http://imbo', client.parseUrls('http://imbo/')[0]);
            assert.equal('http://imbo/some/path', client.parseUrls('http://imbo/some/path/')[0]);
        });

        it('should strip port 80', function() {
            assert.equal('http://imbo', client.parseUrls('http://imbo/:80')[0]);
            assert.equal('http://imbo/some/path', client.parseUrls('http://imbo:80/some/path/')[0]);
        });
    });

    describe('#headImage()', function() {
        it('should return error on a 404-response', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(404);

            client.headImage(catMd5, function(err) {
                assert.equal(404, err);
                done();
            });
        });

        it('should return error on a 503-response', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(503);

            client.headImage(catMd5, function(err) {
                assert.equal(503, err);
                done();
            });
        });

        it('should not return an error on a 200-response', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200);

            client.headImage(catMd5, function(err) {
                assert.ifError(err, 'headImage should not give an error on success');
                done();
            });
        });

        it('should return an http-response on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200, 'OK', { 'X-Imbo-Imageidentifier': catMd5 });

            client.headImage(catMd5, function(err, res) {
                assert.equal(res.headers['x-imbo-imageidentifier'], catMd5);
                done();
            });
        });

        it('should return error when host could not be reached', function(done) {
            this.timeout(10000);
            errClient.headImage(catMd5, function(err) {
                assert.ok(err, 'headImage should give error if host is unreachable');
                done();
            });
        });

    });

    describe('#deleteImage()', function() {
        it('should return an http-response on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .intercept('/users/pub/images/' + catMd5, 'DELETE')
                .reply(200, 'OK', { 'X-Imbo-Imageidentifier': catMd5 });

            client.deleteImage(fixtures + '/cat.jpg', function(err, res) {
                assert.ifError(err, 'Successful delete should not give an error');
                assert.equal(res.headers['x-imbo-imageidentifier'], catMd5);
                done();
            });
        });

        it('should return error if the local image does not exist', function(done) {
            var filename = __dirname + '/does-not-exist.jpg';
            client.deleteImage(filename, function(err, exists) {
                assert.equal('File does not exist (' + filename + ')', err);
                assert.equal(undefined, exists);
                done();
            });
        });
    });

    describe('#deleteImageByIdentifier', function() {
        it('should return an http-response on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .intercept('/users/pub/images/' + catMd5, 'DELETE')
                .reply(200, 'OK', { 'X-Imbo-Imageidentifier': catMd5 });

            client.deleteImageByIdentifier(catMd5, function(err, res) {
                assert.equal(res.headers['x-imbo-imageidentifier'], catMd5);
                done();
            });
        });
    });

    describe('#imageIdentifierExists', function() {
        it('should return true if the identifier exists', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200, 'OK');

            client.imageIdentifierExists(catMd5, function(err, exists) {
                assert.ifError(err, 'Image that exists should not give an error');
                assert.equal(true, exists);
                done();
            });
        });

        it('should return false if the identifier does not exist', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(404, 'Image not found');

            client.imageIdentifierExists(catMd5, function(err, exists) {
                assert.ifError(err, 'imageIdentifierExists should not fail when image does not exist on server');
                assert.equal(false, exists);
                done();
            });
        });

        it('should return an error if the server could not be reached', function(done) {
            errClient.imageIdentifierExists(catMd5, function(err) {
                assert.ok(err, 'imageIdentifierExists should give error if host is unreachable');
                done();
            });
        });
    });

    describe('#imageExists', function() {
        it('should return error if the local image does not exist', function(done) {
            var filename = fixtures + '/non-existant.jpg';
            client.imageExists(filename, function(err, exists) {
                assert.equal('File does not exist (' + filename + ')', err);
                assert.equal(undefined, exists);
                done();
            });
        });

        it('should return true if the image exists on disk and on server', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(200, 'OK');

            client.imageExists(fixtures + '/cat.jpg', function(err, exists) {
                assert.ifError(err, 'imageExists should not give error if image exists on disk and server');
                assert.equal(true, exists);
                done();
            });
        });

        it('should return false if the image exists on disk but not on server', function(done) {
            mock.filteringPath(signatureCleaner)
                .head('/users/pub/images/' + catMd5)
                .reply(404, 'File not found');

            client.imageExists(fixtures + '/cat.jpg', function(err, exists) {
                assert.ifError(err, 'imageExists should not give error if the image does not exist on server');
                assert.equal(false, exists);
                done();
            });
        });
    });

    describe('#addImage', function() {
        it('should return error if the local image does not exist', function(done) {
            var filename = fixtures + '/does-not-exist.jpg';
            client.addImage(filename, function(err, response) {
                assert.ok(err, 'addImage should give error if file does not exist');
                assert.equal(err.code, 'ENOENT');
                assert.equal(undefined, response);
                done();
            });
        });

        it('should return an error if the image could not be added', function(done) {
            mock.filteringPath(signatureCleaner)
                .filteringRequestBody(bodyCleaner)
                .put('/users/pub/images/' + catMd5, '*')
                .reply(400, 'Image already exists', { 'X-Imbo-Imageidentifier': catMd5 });


            client.addImage(fixtures + '/cat.jpg', function(err, imageIdentifier) {
                assert.equal(400, err);
                assert.equal(null, imageIdentifier);
                done();
            });
        });

        it('should return an error if the server could not be reached', function(done) {
            errClient.addImage(fixtures + '/cat.jpg', function(err, imageIdentifier, res) {
                assert.ok(err, 'addImage should give error if host is unreachable');
                done();
            });
        });

        it('should return an image identifier and an http-response on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .filteringRequestBody(bodyCleaner)
                .put('/users/pub/images/' + catMd5, '*')
                .reply(201, { imageIdentifier: catMd5 }, {
                    'X-Imbo-Imageidentifier': catMd5,
                    'Content-Type': 'application/json'
                });

            client.addImage(fixtures + '/cat.jpg', function(err, imageIdentifier, response) {
                assert.equal(undefined, err);
                assert.equal(catMd5, imageIdentifier);
                assert.equal(201, response.statusCode);

                done();
            });
        });

    });

    describe('#addImageFromUrl', function() {
        it('should return error if the remote image does not exist', function(done) {
            var url = stcUrl + '/some-404-image.jpg';
            client.addImageFromUrl(url, function(err, response) {
                assert.ok(err, 'addImage should give error if file does not exist');
                assert.equal(404, err);
                assert.equal(undefined, response);
                done();
            });
        });

        it('should return an error if the image could not be added', function(done) {
            mock.filteringPath(signatureCleaner)
                .filteringRequestBody(bodyCleaner)
                .put('/users/pub/images/' + catMd5, '*')
                .reply(400, 'Image already exists', { 'X-Imbo-Imageidentifier': catMd5 });


            client.addImageFromUrl(stcUrl + '/cat.jpg', function(err, imageIdentifier) {
                assert.equal(400, err);
                assert.equal(null, imageIdentifier);
                done();
            });
        });

        it('should return an error if the server could not be reached', function(done) {
            errClient.addImage(fixtures + '/cat.jpg', function(err, imageIdentifier, res) {
                assert.ok(err, 'addImage should give error if host is unreachable');
                done();
            });
        });

        it('should return an image identifier and an http-response on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .filteringRequestBody(bodyCleaner)
                .put('/users/pub/images/' + catMd5, '*')
                .reply(201, { imageIdentifier: catMd5 }, {
                    'X-Imbo-Imageidentifier': catMd5,
                    'Content-Type': 'application/json'
                });

            client.addImage(fixtures + '/cat.jpg', function(err, imageIdentifier, response) {
                assert.equal(undefined, err);
                assert.equal(catMd5, imageIdentifier);
                assert.equal(201, response.statusCode);

                done();
            });
        });

    });

    describe('#getUserInfo', function() {
        it('should return an object of key => value data', function(done) {
            mock.filteringPath(signatureCleaner)
                .get('/users/pub')
                .reply(200, JSON.stringify({ 'foo': 'bar' }), { 'Content-Type': 'application/json' });

            client.getUserInfo(function(err, info, res) {
                assert.ifError(err, 'getUserInfo should not give an error on success');
                assert.equal('bar', info.foo);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the user does not exist', function(done) {
            mock.filteringPath(signatureCleaner)
                .get('/users/pub')
                .reply(404, 'Not Found');

            client.getUserInfo(function(err, body, res) {
                assert.equal(404, err);
                assert.equal('Not Found', body);
                assert.equal(404, res.statusCode);
                done();
            });
        });
    });

    describe('#getImages', function() {
        it('should return an object of key => value data', function(done) {
            mock.filteringPath(signatureCleaner)
                .get('/users/pub/images')
                .reply(200, JSON.stringify({ 'foo': 'bar' }), { 'Content-Type': 'application/json' });

            client.getImages(null, function(err, meta, res) {
                assert.ifError(err, 'getImages should not give an error on success');
                assert.equal('bar', meta.foo);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(signatureCleaner)
                .get('/users/pub/images/non-existant/meta')
                .reply(404, 'Image not found');

            client.getMetadata('non-existant', function(err, body, res) {
                assert.equal(404, err);
                assert.equal('Image not found', body);
                assert.equal(404, res.statusCode);
                done();
            });
        });
    });

    describe('#getMetadata', function() {
        it('should return an object of key => value data', function(done) {
            mock.filteringPath(signatureCleaner)
                .get('/users/pub/images/' + catMd5 + '/meta')
                .reply(200, JSON.stringify({ 'foo': 'bar' }), { 'Content-Type': 'application/json' });

            client.getMetadata(catMd5, function(err, meta, res) {
                assert.ifError(err, 'getMetadata should not give error on success');
                assert.equal('bar', meta.foo);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(signatureCleaner)
                .get('/users/pub/images/non-existant/meta')
                .reply(404, 'Image not found');

            client.getMetadata('non-existant', function(err, body, res) {
                assert.equal(404, err);
                assert.equal('Image not found', body);
                assert.equal(404, res.statusCode);
                done();
            });
        });
    });

    describe('#deleteMetadata', function() {
        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(signatureCleaner)
                .intercept('/users/pub/images/non-existant/meta', 'DELETE')
                .reply(404, 'Image not found');

            client.deleteMetadata('non-existant', function(err) {
                assert.equal(404, err);
                done();
            });
        });

        it('should not return any error on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .intercept('/users/pub/images/' + catMd5 + '/meta', 'DELETE')
                .reply(200, 'OK');

            client.deleteMetadata(catMd5, function(err) {
                assert.ifError(err, 'deleteMetadata should not give error on success');
                done();
            });
        });
    });

    describe('#editMetadata', function() {
        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(signatureCleaner)
                .post('/users/pub/images/non-existant/meta', { foo: 'bar' })
                .reply(404, 'Image not found');

            client.editMetadata('non-existant', { foo: 'bar' }, function(err) {
                assert.equal(404, err);
                done();
            });
        });

        it('should not return any error on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .post('/users/pub/images/' + catMd5 + '/meta', { foo: 'bar' })
                .reply(200, 'OK');

            client.editMetadata(catMd5, { foo: 'bar' }, function(err, res) {
                assert.ifError(err, 'editMetadata should not give error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });

    describe('#replaceMetadata', function() {
        it('should return an error if the identifier does not exist', function(done) {
            mock.filteringPath(signatureCleaner)
                .put('/users/pub/images/non-existant/meta', { foo: 'bar' })
                .reply(404, 'Image not found');

            client.replaceMetadata('non-existant', { foo: 'bar' }, function(err) {
                assert.equal(404, err);
                done();
            });
        });

        it('should not return any error on success', function(done) {
            mock.filteringPath(signatureCleaner)
                .put('/users/pub/images/' + catMd5 + '/meta', { foo: 'bar' })
                .reply(200, 'OK');

            client.replaceMetadata(catMd5, { foo: 'bar' }, function(err, res) {
                assert.ifError(err, 'replaceMetadata should not give error on success');
                assert.equal(200, res.statusCode);
                done();
            });
        });
    });

});
