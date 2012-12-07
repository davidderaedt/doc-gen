/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

/**  docgen is an extension to generate documentation from
*    JSDoc formatted comments.
*    Note: This extensions parses code looking for jsdoc comments
*    and then tries to understand the context, not the other way.
*    ie non comment members will be ignored
*/
define(function (require, exports, module) {
    'use strict';

    console.log("INITIALIZING doctest EXTENSION");
    
    var Async               = brackets.getModule("utils/Async");
    var CommandManager      = brackets.getModule("command/CommandManager");
    var Menus               = brackets.getModule("command/Menus");
    var StatusBar           = brackets.getModule("widgets/StatusBar");
    var FileIndexManager    = brackets.getModule("project/FileIndexManager");
    var DocumentManager     = brackets.getModule("document/DocumentManager");
    var ProjectManager      = brackets.getModule("project/ProjectManager");  
    var FileUtils           = brackets.getModule("file/FileUtils");      
    var NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem;    
    
    
    var COMMAND_ID  = "docgen.gendoc"; 
    var MENU_NAME   = "Generate docs";

    var projectFolder = ProjectManager.getProjectRoot().fullPath;    
    var templateTxt;
    // TODO expose in config file ?
    var excludedDirectories = ["extensions", "thirdparty", "nls"];
    var totalFiles; // used for stats
    var totalEntries; 
    var totalUnprocessed; // used for stats
    
    // tmp locations
    // TODO determine a way to determine the location of those (config file?)
    var templatePath    = "extensions/dev/doc-gen/doc/template.txt";
    var outputPath      = "extensions/dev/doc-gen/doc/index.html";
    
    
    
    function loadTemplate() {
        
        var projectFolder = ProjectManager.getProjectRoot().fullPath;
        var templateFile = new NativeFileSystem.FileEntry(projectFolder + templatePath);       
        
        FileUtils.readAsText(templateFile)
            .done(function (rawText, readTimestamp) {
                templateTxt = rawText;
            })
            .fail(function (err) {
                console.log(err);
            });          
    }
    
    
    
    function doMyCommand() {
        
        if (templateTxt === null) {
            console.log("No documentation template found. Aborting.");            
            return;
        }
        
        console.log("Executing Command gendoc");
        
        parseFiles();     
    }
    
    
    function parseFiles() {
        
        var documentedFiles = [];
        totalUnprocessed = 0 ;
        totalEntries = 0;
        totalFiles = 0 ;
        
        StatusBar.showBusyIndicator(true);
        
        FileIndexManager.getFileInfoList("all")
            .done(function (fileListResult) {
                
                Async.doInParallel(fileListResult, function (fileInfo) {
                    
                    var result = new $.Deferred();
                    
                    var filename = fileInfo.name;
                    var extIndex = filename.lastIndexOf(".");
                    var ext = filename.slice(extIndex);
                    var relPath = fileInfo.fullPath.split(projectFolder)[1];
                    var mainDir = relPath.split("/")[0];
                    

                                        
                    if (ext != ".js" || shouldExclude(mainDir)) {
                        result.resolve();
                        return result.promise();
                    }

                    DocumentManager.getDocumentForPath(fileInfo.fullPath)
                        .done(function (doc) {
                            
                            totalFiles++
                            //console.log("PARSING FILE:", doc);
                            
                            var docFileObj = parseFileContents(filename, doc.getText());
                            docFileObj.path = relPath;
                            docFileObj.name = filename.split(".")[0];
                            
                            documentedFiles.push(docFileObj);
                            
                            totalEntries += docFileObj.entries.length;
                            
                            result.resolve();
                        })
                        .fail(function (error) {
                            // Error reading this file. This is most likely because the file isn't a text file.
                            // Resolve here so we move on to the next file.
                            result.resolve();
                        });
                    
                    return result.promise();
                })
                    .done(function () {
                        
                        createtxtFrom(documentedFiles);
                        
                        console.log(documentedFiles.length + " source files documented out of " + totalFiles + " files in total.");
                        console.log(totalEntries + " entries generated.");
                        console.log(totalUnprocessed + " entries unprocessed (see logs for details).");
                                                
                        StatusBar.hideBusyIndicator();
                    })
                    .fail(function () {
                        console.log("find in files failed.");
                        StatusBar.hideBusyIndicator();
                    });
            });           
    }
    

    function shouldExclude(dir) {
        var i;
        for (i = 0; i < excludedDirectories.length; i++) {
            if(dir == excludedDirectories[i]) return true;
        }
        return false;
    }    
            
    /*
        Mainly inspired by Dox.js
        https://github.com/visionmedia/dox/
    */
    function parseFileContents(filename, src) {
        
        var fileobj = {
            entries : [],
            desc : "",
            filename : filename
        };
            
        var comment = "";
        var entry;
        var inComment = false;
        var cstart;
        
        for (var i = 0, len = src.length; i < len; ++i) {
            
            if (!inComment && src[i] == "/" && src[i + 1] == "*" && src[i + 2] == "*") {
                i += 3;
                cstart = i;
                inComment = true;
            } else if (inComment && src[i] == "*" && src[i + 1] == "/") {
                comment = src.slice(cstart, i);
                
                // find out what we're trying to comment
                entry = parseCodeContext(src.slice(i + 2));
                
                if (entry) {
                    
                    // make sense of the actual comment
                    entry.comment = processComment(comment);
                    
                    // Comments before define statements describe the whole module
                    if (entry.type == "define") {
                        fileobj.desc = entry.comment.body;//comment.replace(/\n\s*\*/g, "\n");
                    }
                    fileobj.entries.push(entry);
                }
                
                inComment = false;
                i += 2;
            }
            
        }
        
        return fileobj;                     
        
    }
    
    function processComment(comString) {
        
        var comment = {
                body : "",
                isClass : false,
                access : "public",
                returns : "void"
                };
        
        //comString = comString.replace(/^\s*\n/, "");
        // get rid of * chars
        comment.body =  comString.replace(/\n\s*\*/g, "\n");
        comment.body = comment.body.replace(/^\s*\n/, "");
        
        if(comString.indexOf("@private")>=0) comment.access = "private";
        if(comString.indexOf("@constructor")>=0) comment.isClass = true;
        if (/@return {(\w+)}/gm.exec(comString)) {
            comment.returns = RegExp.$1;
        }         
        
        // todo : remove "?" options for curly braces as it's only there
        // because of some malformed annotations.
        if (/@type {?(\w+)}?/gm.exec(comString)) {
            comment.returns = RegExp.$1;
        }         
        
        // TODO : process all jsdoc tokens
        
        return comment;
    }

    
    /*
        Original regexps found in Dox.js
        https://github.com/visionmedia/dox/
    */    
    function parseCodeContext(str) {
        
        //removing whitespace
        str = str.replace(/^\s*/m, "");
        //str = str.split('\n')[0];
        
        // function statement
        if (/^function (\w+) *\(/.exec(str)) {
            return {
                type: 'function',
                name: RegExp.$1,
                string: RegExp.$1 + '()'
            };
        // define
        } else if (/^define/.exec(str)) {
            return {
                type: 'define', 
                name: RegExp.$1,
                string: RegExp.$1 + '()'
            }; 
        // function expression 
        } else if (/^var *(\w+) *= *function/.exec(str)) {
            return {
                type: 'function',
                name: RegExp.$1,
                string: RegExp.$1 + '()'
            };
          // prototype method
        } else if (/^(\w+)\.prototype\.(\w+) *= *function/.exec(str)) {
            return {
                type: 'prototype-method',
                constructor: RegExp.$1,
                cons: RegExp.$1,
                name: RegExp.$2,
                string: RegExp.$1 + '.prototype.' + RegExp.$2 + '()'
            };
        // prototype property
        } else if (/^(\w+)\.prototype\.(\w+) *= *([^\n;]+)/.exec(str)) {
            return {
                type: 'prototype-property',
                constructor: RegExp.$1,
                cons: RegExp.$1,
                name: RegExp.$2,
                value: RegExp.$3,
                string: RegExp.$1 + '.prototype' + RegExp.$2
            };
        // method
        } else if (/^([\w.]+)\.(\w+) *= *function/.exec(str)) {
            return {
                type: 'method',
                receiver: RegExp.$1,
                name: RegExp.$2,
                string: RegExp.$1 + '.' + RegExp.$2 + '()'
            };
        // property
        } else if (/^(\w+)\.(\w+) *= *([^\n;]+)/.exec(str)) {
            return {
                type: 'property',
                receiver: RegExp.$1,
                name: RegExp.$2,
                value: RegExp.$3,
                string: RegExp.$1 + '.' + RegExp.$2
            };
        // declaration
        } else if (/^var +([\$\w]+) *= *([^\n;]+)/.exec(str)) {
            return {
                type: 'var-declaration',
                name: RegExp.$1,
                value: RegExp.$2,
                string: RegExp.$1
            };
        } else if (/^var +([\$\w]+) *;/.exec(str)) {
            return {
                type: 'var-declaration*',
                name: RegExp.$1,
                value: "null",
                string: RegExp.$1
            };
        } else {
            totalUnprocessed ++;
            console.log("Unable to process context:", [str]);
            return null;
        }
    }
                    
    
    function createtxtFrom(results) {
        
        var le = "\n";
        
        var txt = templateTxt;
                
        var menuStr = "";
        var mainStr = "";
        
        var i;
        for (i = 0; i < results.length; i++) {
            var f = results[i];
            mainStr += getHTMLForFile(f);
            menuStr += "<li><a href=\"#" + f.name + "\">" + f.name + "</a></li>" + le;
        }

        txt = txt.replace("{menuStr}", menuStr);
        txt = txt.replace("{mainStr}", mainStr);
                      
        //console.log(txt);
        createFile(txt);
    }
    
    
    // This could use templates too...
    function getHTMLForFile(fileObj) {
        var le = "\n";
        var txt = "<a name=\"" + fileObj.name + "\"></a><article>" + le;
        
        txt += "<h1>" + fileObj.name + "</h1>" + le;
        txt += "<p class=\"path\">" + fileObj.path + "</p>" + le;
        txt += "<p>" + toHTML(fileObj.desc) + "</p>" + le;
        
        var i;
        for (i = 0; i < fileObj.entries.length; i++) {
            var entry = fileObj.entries[i];
            if (entry.type == "define") continue;
            if (entry.type == "prototype-method") entry.name = entry.cons + "." + entry.name;
            
            if(entry.comment.isClass) {
                txt += "<pre><code><span>" + entry.comment.access + "</span><h2>Class: " + entry.name + "</h2></code></pre>";
            }
            else { 
                txt += "<pre><code><span>" + entry.comment.access + " " + entry.comment.returns + "</span><h2>" + entry.string + "</h2></code></pre>";
            }
            txt += "<p>" + toHTML(entry.comment.body) + "</p>" + le;
            txt += "<hr>" + le;        
        }
        
        txt += "</article>" + le;
        txt += "<hr>" + le;
        txt += "<hr>" + le;
        
        return txt;
        
    }
    
    
    function toHTML(str) {
        str = htmlDecode(str);
        str =  str.replace(/\n/g, "<br>");
        return str;
    }
    
    
    
    function htmlDecode(value) {
        if (value) {
            return $('<div />').html(value).text();
        } else {
            return '';
        }
    }   
    
    
    
    function createFile(destContent) {
        
        var destPath = projectFolder + outputPath;
        //console.log(destPath);
        
        var destFile = new NativeFileSystem.FileEntry(destPath);
        
        FileUtils.writeText(destFile, destContent)
            .fail(function (err) {
                console.log(err);
            });
    }

    
    // Yes, we load the template at startup.
    // Not sure this such a good idea though.
    loadTemplate();

    CommandManager.register(MENU_NAME, COMMAND_ID, doMyCommand);
    
    // I'd rather have it in a "Project" Menu...
    var menu = Menus.getMenu(Menus.AppMenuBar.HELP_MENU);
    menu.addMenuDivider();
    menu.addMenuItem(COMMAND_ID);
    
});