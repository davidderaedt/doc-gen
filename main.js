/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

/**  docgen is an extension to generate documentation from
*    JSDoc formatted comments.
*    It parses code looking for jsdoc comments
*    and then tries to understand the context, not the other way.
*    ie non-commented members will be ignored
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

    var moduleDir = FileUtils.getNativeModuleDirectoryPath(module);
    var projectFolder = ProjectManager.getProjectRoot().fullPath;    
    var options;
    var templateTxt;    
    
    // the following are used for stats
    var totalFiles; 
    var totalEntries;    
        
    
    function executeGendocCommand() {
        loadConfig();        
    }
    
    
    function loadConfig() {
        
        console.log("Loading Config");        
        
        var configFile = new NativeFileSystem.FileEntry(moduleDir + '/config.json');
                
        FileUtils.readAsText(configFile)
            .done(function (text, readTimestamp) {
                try {
                    options = JSON.parse(text);
                    loadTemplate();
                    
                } catch (e) {
                    console.log("Can't parse config.json - " + e);
                }
            })
            .fail(function (err) {
                console.log(err);
                console.log("No config found. Aborting.");            
            });
    }
    
    
    function loadTemplate() {
        
        console.log("Loading Template:" + options.templatePath);
        
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
        
        console.log("Parsing Project");
        
        var documentedFiles = [];
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
                            docFileObj.shortName = filename.split(".")[0];
                            
                            
                            if(docFileObj.entries.length > 0) {
                                documentedFiles.push(docFileObj);
                                totalEntries += docFileObj.entries.length;
                            }
                            
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
                        
                        console.log("Generate Documentation");
                        
                        var txt = htmlDocExporter.getHTMLDocFor(documentedFiles, templateTxt, options.ignorePrivate);
                        
                        createTxtFile(txt, projectFolder + options.outputPath);
                        
                        console.log(documentedFiles.length + " source files documented out of " + totalFiles + " files in total.");
                        console.log(totalEntries + " entries generated.");
                        console.log(htmlDocExporter.getUnprocessedCount() + " entries unprocessed (see logs for details).");
                                                
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
            
    
    // not used for now
    function getModuleEntry(entries) {
        var i;
        for (i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (entry.code && entry.code.type == "module") return entry;
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