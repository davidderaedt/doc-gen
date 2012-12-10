/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $ */


define(function (require, exports, module) {
    'use strict';

    var codeParser          = require("codeParser");
    
            
    var totalUnprocessed;
    
    /*
        Parsing logic originally inspired by Dox.js
        https://github.com/visionmedia/dox/
    */
    
    function parseFileContents(src) {
        
        var entries = [];
            
        var comment = "";
        var entry;
        var inComment = false;
        var cstart;
        totalUnprocessed=0;
        
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
                
                // get the code after the comment
                var sourceCode = src.slice(i);
                
                // remove leading whitespace
                sourceCode = sourceCode.replace(/^\s*/m, "");
                
                // (used for debugging)
                var firstLine = sourceCode.split("\n")[0];
                
                // ignore annotations if it's before another comment
                if (sourceCode.indexOf("/*") === 0 || sourceCode.indexOf("//") === 0) {
                    totalUnprocessed ++;
                    console.log("Ignoring annotation before comment:", [firstLine]);
                    continue;
                }
                
                // Analyze what we're trying to comment
                entry = codeParser.parseCode(sourceCode);
                
                if (entry) {
                    
                    // make sense of the actual comment
                    entry.comment = parseAnnotation(comment);

                    entries.push(entry);
                }
                
                else {
                    console.log("Unable to process context:", [firstLine]);
                    totalUnprocessed ++;
                }
                
            }
            
        }
        
        return entries;                     
        
    }    
    
    /**    
     * parses a string representing a jsdoc annotation
     * and returns a corresponding description object    
     * @param {type} comString string representing a jsdoc annotation    
     */
    
    function parseAnnotation(comString) {
        
        var comment = {
                body : "",
                isClass : false,
                access : "public",
                returns : "void"
            };
        
        // get rid of * chars and space
        comment.body =  comString.replace(/\n\s*\*/g, "\n");
        comment.body = comment.body.replace(/^\s*\n/, "");
        
        if (comString.indexOf("@private") >= 0) comment.access = "private";
        if (comString.indexOf("@constructor") >= 0) comment.isClass = true;
        
        if (/@return {(.*)}/gm.exec(comString)) {
            comment.returns = RegExp.$1;
        }         
        
        // todo : remove "?" options for curly braces as it's only there
        // because of some malformed annotations in brackets src
        if (/@type {?(.*)}?/gm.exec(comString)) {
            comment.returns = RegExp.$1;
        }         
        
        // TODO : process all jsdoc tokens
        
        return comment;
    }    
    
    
    function getUnprocessedCount() {
        return totalUnprocessed;
    }
    
    exports.parseFileContents = parseFileContents;
    exports.parseAnnotation = parseAnnotation;
    exports.getUnprocessedCount = getUnprocessedCount;
   
});