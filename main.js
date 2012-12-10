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

    //console.log("INITIALIZING doctest EXTENSION");
    
    var Async               = brackets.getModule("utils/Async");
    var CommandManager      = brackets.getModule("command/CommandManager");
    var Menus               = brackets.getModule("command/Menus");
    var StatusBar           = brackets.getModule("widgets/StatusBar");
    var FileIndexManager    = brackets.getModule("project/FileIndexManager");
    var DocumentManager     = brackets.getModule("document/DocumentManager");
    var ProjectManager      = brackets.getModule("project/ProjectManager");  
    var FileUtils           = brackets.getModule("file/FileUtils");      
    var NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem;    
    var codeParser          = require("codeParser");
    var jsDocParser         = require("JSDocParser");
    var htmlDocExporter     = require("htmlDocExporter");
    
    var COMMAND_ID  = "docgen.gendoc"; 
    var MENU_NAME   = "Generate docs";

    var projectFolder = ProjectManager.getProjectRoot().fullPath;    
    var templateTxt;
    
    // Options
    // TODO expose in a config file ?
    var excludedDirectories = ["extensions", "thirdparty", "nls"];
    var ignorePrivate   = false;
    var templatePath    = "extensions/dev/doc-gen/doc/template.txt";
    var outputPath      = "extensions/dev/doc-gen/doc/index.html";
    
    // the following are used for stats
    var totalFiles; 
    var totalEntries; 
    var totalUnprocessed;
    
    
    
    
    function loadTemplate() {
        
        //var projectFolder = ProjectManager.getProjectRoot().fullPath;
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
        
        console.log("Generating documentation...");
        
        parseProject();     
    }
    
    
    function parseProject() {
        
        var documentedFiles = [];
        totalUnprocessed = 0;
        totalEntries = 0;
        totalFiles = 0;
        
        StatusBar.showBusyIndicator(true);
        
        FileIndexManager.getFileInfoList("all")
            .done(function (fileListResult) {
                
                Async.doInParallel(fileListResult, function (fileInfo) {
                    
                    var result = new $.Deferred();
                    
                    var filename = fileInfo.name;
                    var extIndex = filename.lastIndexOf(".");
                    var ext = filename.slice(extIndex);
                    var relativePath = fileInfo.fullPath.split(projectFolder)[1];
                    var mainDir = relativePath.split("/")[0];
                    
                    if (ext != ".js" || shouldExclude(mainDir)) {
                        result.resolve();
                        return result.promise();
                    }

                    DocumentManager.getDocumentForPath(fileInfo.fullPath)
                        .done(function (doc) {
                            
                            totalFiles++;
                            //console.log("PARSING FILE:", doc);
                            
                            var docFileObj = parseFileContents(filename, doc.getText());
                            docFileObj.path = relativePath;
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
                        
                        var txt = htmlDocExporter.getHTMLDocFor(documentedFiles, templateTxt, ignorePrivate);
                        
                        createTxtFile(txt, projectFolder + outputPath);
                        
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
            if (dir == excludedDirectories[i]) return true;
        }
        return false;
    }    
            
    /*
        Parsing logic originally inspired by Dox.js
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
            } 
            else if (inComment && src[i] == "*" && src[i + 1] == "/") {

                inComment = false;                
                comment = src.slice(cstart, i);

                i += 2;
                                                                
                var sourceCode = src.slice(i);
                
                // remove whitespace
                sourceCode = sourceCode.replace(/^\s*/m, "");
                // useful for debugging
                var firstLine = sourceCode.split("\n")[0];
                
                // ignore annotations if it's before another comment
                if (sourceCode.indexOf("/*") === 0 || sourceCode.indexOf("//") === 0) {
                    totalUnprocessed ++;
                    console.log(filename, "Ignoring annotation before comment:", [firstLine]);
                    continue;
                }
                
                // Analyze what we're trying to comment
                entry = codeParser.parseCode(sourceCode);
                
                if (entry) {
                    
                    // make sense of the actual comment
                    entry.comment = jsDocParser.parseAnnotation(comment);
                    
                    // Comments before define statements describe the whole module
                    if (entry.type == "define") {
                        fileobj.desc = entry.comment.body;
                    }
                    fileobj.entries.push(entry);
                }
                
                else {
                    console.log(filename, "Unable to process context:", [firstLine]);
                    totalUnprocessed ++;
                }
                
            }
            
        }
        
        return fileobj;                     
        
    }
    
    
    
    function createTxtFile(content, destPath) {
                
        var destFile = new NativeFileSystem.FileEntry(destPath);
        
        FileUtils.writeText(destFile, content)
            .done(function () {
                console.log("Documentation files successfully generated");
            })
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