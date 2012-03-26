/**
 * 
 */

var fs = require('fs');
function xgettext_find(str) {
	var results = [], re = /_\(['"]([^)]+)['"]\)/g, text;
	while (text = re.exec(str)) {
		results.push(text[1]);
	}
	return results;
}

var walk = function(dir, done) {
	var results = [];
	fs.readdir(dir, function(err, list) {
		if (err)
			return done(err);
		var i = 0;
		(function next() {
			var file = list[i++];
			if (!file)
				return done(null, results);
			if (file != '.git') {
				file = dir + '/' + file;
				fs.stat(file, function(err, stat) {
					if (stat && stat.isDirectory()) {
						walk(file, function(err, res) {
							results = results.concat(res);
							next();
						});
					} else {
						if (file.slice(-3) == '.js')
							results.push(file);
						next();
					}
				});
			} else
				next();
		})();
	});
};

/*
 * This function is loosely based on the one found here:
 * http://www.weanswer.it/blog/optimize-css-javascript-remove-comments-php/
 */
function removeComments(str) {
	str = ('__' + str + '__').split('');
	var mode = {
		singleQuote : false,
		doubleQuote : false,
		regex : false,
		blockComment : false,
		lineComment : false,
		condComp : false
	};
	for ( var i = 0, l = str.length; i < l; i++) {

		if (mode.regex) {
			if (str[i] === '/' && str[i - 1] !== '\\') {
				mode.regex = false;
			}
			continue;
		}

		if (mode.singleQuote) {
			if (str[i] === "'" && str[i - 1] !== '\\') {
				mode.singleQuote = false;
			}
			continue;
		}

		if (mode.doubleQuote) {
			if (str[i] === '"' && str[i - 1] !== '\\') {
				mode.doubleQuote = false;
			}
			continue;
		}

		if (mode.blockComment) {
			if (str[i] === '*' && str[i + 1] === '/') {
				str[i + 1] = '';
				mode.blockComment = false;
			}
			str[i] = '';
			continue;
		}

		if (mode.lineComment) {
			if (str[i + 1] === '\n' || str[i + 1] === '\r') {
				mode.lineComment = false;
			}
			str[i] = '';
			continue;
		}

		if (mode.condComp) {
			if (str[i - 2] === '@' && str[i - 1] === '*' && str[i] === '/') {
				mode.condComp = false;
			}
			continue;
		}

		mode.doubleQuote = str[i] === '"';
		mode.singleQuote = str[i] === "'";

		if (str[i] === '/') {
			if (str[i + 1] === '*' && str[i + 2] === '@') {
				mode.condComp = true;
				continue;
			}
			if (str[i + 1] === '*') {
				str[i] = '';
				mode.blockComment = true;
				continue;
			}
			if (str[i + 1] === '/') {
				str[i] = '';
				mode.lineComment = true;
				continue;
			}
			mode.regex = true;
		}
	}
	return str.join('').slice(2, -2);
}

/**
 * Read supported locale translations
 */

var supported = {};
var locales = fs.readdirSync('./locale/');
// checking for a dir
for ( var idx = 0; idx < locales.length; idx++) {
	var stat = fs.statSync('./locale/' + locales[idx]);
	if (stat && !stat.isDirectory())
		locales.splice(idx, 1);
}

var re = /^(msgid|msgstr)\s['"](.*)['"]$/;
var valre = /^['"](.*)['"]$/;
for ( var li = 0; li < locales.length; li++) {
	var locale = supported[locales[li]] = {};
	try {
		var lines = fs.readFileSync('./locale/' + locales[li] + '/messages.po',
				'utf-8').toString().split('\n');
		var msgid = null;
		for ( var idx = 0; idx < lines.length; idx++) {
			var line = lines[idx].replace(/^\s\s*/, '').replace(/\s\s*$/, '');
			if (line != '') {
				var result = re.exec(line);
				if (result != null) {
					var key = result[1];
					var value = result[2];
					if (key == 'msgid') {
						msgid = value;
						locale[msgid] = [];
					} else if (key == 'msgstr') {
						locale[msgid].push(value);
					}
				} else {
					var res = valre.exec(line);
					if (res && (res.length > 1))
						locale[msgid].push(res[1]);
				}
			}
		}
	} catch (e) {
		if (e.code == 'ENOENT') {
			fs.open(e.path, 'a', function(err, fd) {
				fs.closeSync(fd);
			});
		} else
			console.log(e);
	}
}

/**
 * Walk for a '.js' files
 */
walk('.',
		function(err, files) {
			var transkeys = {};
			if (err)
				throw err;
			/**
			 * Find keys
			 */
			for ( var idx = 0; idx < files.length; idx++) {
				var keys = xgettext_find(removeComments(fs.readFileSync(
						files[idx], 'utf-8').toString()));
				for ( var ki = 0; ki < keys.length; ki++) {
					transkeys[keys[ki]] = true;
				}
			}

			// Patch locales
			for ( var locname in supported) {
				var locale = supported[locname];
				for ( var keyname in transkeys) {
					if (!locale[keyname])
						locale[keyname] = '';
				}
				// store locale
				var buff = '';
				for ( var keyname in locale) {
					buff += "msgid \"" + keyname + "\"\n" + "msgstr ";
					var values = locale[keyname];
					if (values.length > 0) {
						for ( var vi = 0; vi < values.length; vi++)
							buff += "\"" + values[vi] + "\"\n";
						buff += "\n";
					} else
						buff += "\"\"\n\n";
				}
				fs.writeFileSync('./locale/' + locname + '/messages.po', buff,
						'utf-8');
			}
		});
