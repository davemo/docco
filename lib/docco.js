(function() {
  var destination, docco_styles, docco_template, ensure_directory, exec, ext, fs, generate_documentation, generate_html, get_language, highlight, highlight_end, highlight_start, l, languages, parse, path, showdown, sources, spawn, template, _ref;
  generate_documentation = function(source, callback) {
    return fs.readFile(source, "utf-8", function(error, code) {
      var sections;
      if (error) {
        throw error;
      }
      sections = parse(source, code);
      return highlight(source, sections, function() {
        generate_html(source, sections);
        return callback();
      });
    });
  };
  parse = function(source, code) {
    var code_text, docs_text, has_code, language, line, lines, replace_end_comment, replace_start_and_end_comments, replace_start_comment, save, sections, templine, _i, _len;
    lines = code.split('\n');
    sections = [];
    language = get_language(source);
    has_code = docs_text = code_text = '';
    save = function(docs, code) {
      return sections.push({
        docs_text: docs,
        code_text: code
      });
    };
    replace_start_and_end_comments = function(line) {
      var temp;
      temp = replace_start_comment(line);
      return replace_end_comment(temp);
    };
    replace_start_comment = function(line) {
      return line.replace(language.comment_matcher, '');
    };
    replace_end_comment = function(line) {
      return line.replace(language.end_comment_matcher, '');
    };
    for (_i = 0, _len = lines.length; _i < _len; _i++) {
      line = lines[_i];
      if (line.match(language.comment_matcher) && !line.match(language.comment_filter)) {
        if (has_code) {
          save(docs_text, code_text);
          has_code = docs_text = code_text = '';
        }
        templine = language.end_comment_matcher ? replace_start_and_end_comments(line) : replace_start_comment(line);
        docs_text += templine + '\n';
      } else {
        has_code = true;
        code_text += line + '\n';
      }
    }
    save(docs_text, code_text);
    return sections;
  };
  highlight = function(source, sections, callback) {
    var html_comment, language, output, pygments, section;
    language = get_language(source);
    pygments = spawn('pygmentize', ['-l', language.name, '-f', 'html', '-O', 'encoding=utf-8']);
    output = '';
    html_comment = new RegExp('<span class="c">&[^\s]*</span>', 'g');
    pygments.stderr.addListener('data', function(error) {
      if (error) {
        return console.error(error);
      }
    });
    pygments.stdout.addListener('data', function(result) {
      if (result) {
        return output += result;
      }
    });
    pygments.addListener('exit', function() {
      var fragments, i, section, _len;
      output = output.replace(highlight_start, '').replace(highlight_end, '').replace(html_comment, '<span class="c"><!--DIVIDER--></span>');
      fragments = output.split(language.divider_html);
      for (i = 0, _len = sections.length; i < _len; i++) {
        section = sections[i];
        section.code_html = highlight_start + fragments[i] + highlight_end;
        section.docs_html = showdown.makeHtml(section.docs_text);
      }
      return callback();
    });
    pygments.stdin.write(((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sections.length; _i < _len; _i++) {
        section = sections[_i];
        _results.push(section.code_text);
      }
      return _results;
    })()).join(language.divider_text));
    return pygments.stdin.end();
  };
  generate_html = function(source, sections) {
    var dest, html, title;
    title = path.basename(source);
    dest = destination(source);
    html = docco_template({
      title: title,
      sections: sections,
      sources: sources,
      path: path,
      destination: destination
    });
    console.log("docco: " + source + " -> " + dest);
    return fs.writeFile(dest, html);
  };
  fs = require('fs');
  path = require('path');
  showdown = require('./../vendor/showdown').Showdown;
  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;
  languages = {
    '.coffee': {
      name: 'coffee-script',
      symbol: '#'
    },
    '.js': {
      name: 'javascript',
      symbol: '//'
    },
    '.rb': {
      name: 'ruby',
      symbol: '#'
    },
    '.html': {
      name: 'html',
      symbol: '<!--',
      end_symbol: '-->'
    }
  };
  for (ext in languages) {
    l = languages[ext];
    l.comment_matcher = new RegExp('^\\s*' + l.symbol + '\\s?');
    if (l.end_symbol) {
      l.end_comment_matcher = new RegExp(l.end_symbol + '\\s?');
    }
    l.comment_filter = new RegExp('(^#![/]|^\\s*#\\{)');
    l.divider_text = l.end_symbol ? '\n' + l.symbol + 'DIVIDER' + l.end_symbol + '\n' : '\n' + l.symbol + 'DIVIDER\n';
    l.divider_html = l.end_symbol ? new RegExp('\\n*<span class="c1?">' + l.symbol + 'DIVIDER' + l.end_symbol + '<\\/span>\\n*') : new RegExp('\\n*<span class="c1?">' + l.symbol + 'DIVIDER<\\/span>\\n*');
  }
  get_language = function(source) {
    return languages[path.extname(source)];
  };
  destination = function(filepath) {
    return 'docs/' + path.basename(filepath, path.extname(filepath)) + '.html';
  };
  ensure_directory = function(callback) {
    return exec('mkdir -p docs', function() {
      return callback();
    });
  };
  template = function(str) {
    return new Function('obj', 'var p=[],print=function(){p.push.apply(p,arguments);};' + 'with(obj){p.push(\'' + str.replace(/[\r\t\n]/g, " ").replace(/'(?=[^<]*%>)/g, "\t").split("'").join("\\'").split("\t").join("'").replace(/<%=(.+?)%>/g, "',$1,'").split('<%').join("');").split('%>').join("p.push('") + "');}return p.join('');");
  };
  docco_template = template(fs.readFileSync(__dirname + '/../resources/docco.jst').toString());
  docco_styles = fs.readFileSync(__dirname + '/../resources/docco.css').toString();
  highlight_start = '<div class="highlight"><pre>';
  highlight_end = '</pre></div>';
  sources = process.ARGV.sort();
  if (sources.length) {
    ensure_directory(function() {
      var files, next_file;
      fs.writeFile('docs/docco.css', docco_styles);
      files = sources.slice(0);
      next_file = function() {
        if (files.length) {
          return generate_documentation(files.shift(), next_file);
        }
      };
      return next_file();
    });
  }
}).call(this);
