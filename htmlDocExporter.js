/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $ */


define(function (require, exports, module) {
    'use strict';
    
    
    /**    
     * @returns {string} String representing an HTML document
     * @param {array} results Array of docFile objects
     * @param {string} templateTxt a string representing an HTML template
     */
    
    function getHTMLDocFor(results, templateTxt, ignorePrivate) {
        
        var le = "\n";
        
        var txt = templateTxt;
                
        var menuStr = "";
        var mainStr = "";
        
        var i;
        for (i = 0; i < results.length; i++) {
            var f = results[i];
            mainStr += getHTMLForFile(f, ignorePrivate);
            menuStr += "<li><a href=\"#" + f.moduleName + "\">" + f.moduleName + "</a></li>" + le;
        }

        txt = txt.replace("{menuStr}", menuStr);
        txt = txt.replace("{mainStr}", mainStr);
                      
        //console.log(txt);
        return txt;
    }
    
    
    // This should use templates too...
    function getHTMLForFile(fileObj, ignorePrivate) {
        var le = "\n";
        
        var txt = "";
        
        txt += "<a name=\"" + fileObj.moduleName + "\"></a><article>" + le;
        txt += "<h1>" + fileObj.moduleName + "</h1>" + le;
        txt += "<p class=\"path\">" + fileObj.path + "</p>" + le;        
        txt += "<p>" + toHTML(fileObj.desc) + "</p>" + le;
        
        var i;
        for (i = 0; i < fileObj.entries.length; i++) {
            
            var entry = fileObj.entries[i];
            
            if (entry.type == "module") continue;
            
            if (ignorePrivate && entry.comment.access == "private") continue;
            
            if (entry.type == "prototype-method") entry.name = entry.cons + "." + entry.name;
                        
            var printName = entry.string;
            
            if (entry.comment.isClass) printName = entry.name + " Class";

            txt += "<pre><code><h2>" + printName + "</h2></code></pre>";
            txt += "<p><strong>return type: </strong><code>" + toHTML(entry.comment.returns) + "</code></p>" + le;
            txt += "<p><strong>access: </strong><code>" + entry.comment.access + "</code></p>" + le;
            
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
        
    
    exports.getHTMLDocFor = getHTMLDocFor;
    
});        