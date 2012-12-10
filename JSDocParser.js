/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $ */


define(function (require, exports, module) {
    'use strict';
    
    
    
    /**    
     * parses a string representing a jsdoc annotation
     and returns a corresponding object    
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
    
    exports.parseAnnotation = parseAnnotation;
   
});