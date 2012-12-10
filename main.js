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
    var jsDocParser         = require("JSDocParser");
    var htmlDocExporter     = require("htmlDocExporter");
    
    var COMMAND_ID  = "docgen.gendoc"; 
    var MENU_NAME   = "Generate docs";

    var projectFolder = ProjectManager.getProjectRoot().fullPath;    
    var templateTxt;
    
    // Options
    // TODO expose in a config file
    var options = {
        excludedDirectories : ["extensions", "thirdparty", "nls"],
        ignorePrivate   : false,
        templatePath    : "extensions/dev/doc-gen/doc/template.txt",
        outputPath      : "extensions/dev/doc-gen/doc/index.html"
    
    };
    
    // the following are used for stats
    var totalFiles; 
    var totalEntries; 
    var totalUnprocessed;
    
        
    
    function executeGendocCommand() {
                
        //console.log("Loading Template:" + options.templatePath);
        
        var templateFile = new NativeFileSystem.FileEntry(projectFolder + options.templatePath);       
        
        FileUtils.readAsText(templateFile)
            .done(function (rawText, readTimestamp) {
                
                templateTxt = rawText;
                
                parseProject();
                
            })
            .fail(function (err) {
                console.log(err);
                console.log("No documentation template found. Aborting.");            
            });
                    
    }
    
    
    function parseProject() {
        
        //console.log("Parsing Project");
        
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
                            
                            var docFileObj = {};
                            docFileObj.entries = jsDocParser.parseFileContents(doc.getText());
                            docFileObj.path = relativePath;
                            docFileObj.filename = filename;
                            docFileObj.desc = "";
                            docFileObj.isModule = false;
                            docFileObj.moduleName = filename.split(".")[0];
                            
                            var moduleEntry = getModuleEntry(docFileObj.entries);
                            
                            if (moduleEntry) {
                                docFileObj.isModule = true;
                                docFileObj.desc = moduleEntry.comment.body;
                            }
                            
                            
                            documentedFiles.push(docFileObj);
                            
                            totalEntries += docFileObj.entries.length;
                            totalUnprocessed += jsDocParser.getUnprocessedCount();
                            
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
                        
                        var txt = htmlDocExporter.getHTMLDocFor(documentedFiles, templateTxt, options.ignorePrivate);
                        
                        createTxtFile(txt, projectFolder + options.outputPath);
                        
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
        for (i = 0; i < options.excludedDirectories.length; i++) {
            if (dir == options.excludedDirectories[i]) return true;
        }
        return false;
    }    
            
    
    
    function getModuleEntry(entries) {
        var i;
        for (i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (entry.type == "module") return entry;
        }
        return null;
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

    

    CommandManager.register(MENU_NAME, COMMAND_ID, executeGendocCommand);
    
    // I'd rather have it in a "Project" Menu...
    var menu = Menus.getMenu(Menus.AppMenuBar.HELP_MENU);
    menu.addMenuDivider();
    menu.addMenuItem(COMMAND_ID);
    
});