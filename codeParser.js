/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $ */


define(function (require, exports, module) {
    'use strict';
        

    /**
        Tries to analyze a string representing a js source
        @param {String} str The string representing the source code
        @returns {Object} An object representing the code
    */        
    
    function parseCode(src) {
        
        //removing whitespace
        var str = src.replace(/^\s*/m, "");
        
        // get the firstline (used for debugging)
        var firstline = str.split('\n')[0];
        
        // function statement
        if (/^function\s*(\w+)\s*\(([^)]*)\)/m.exec(str)) {
            return {
                type: 'function',
                name: RegExp.$1,
                params: RegExp.$2,
                firstline : firstline,
                string: RegExp.$1 + " (" + RegExp.$2 + ")"
            };
        }
        // define / AMD module        
        else if (/^define/.exec(str)) {
            return {
                type: "module", 
                firstline : firstline,
                string: "module"
            }; 
        }        
        // iife       
        else if (/^\(function\s*\(([^)]*)\)/.exec(str)) {
            return {
                type: "iife", 
                params: RegExp.$1,
                firstline : firstline,
                string: "function (" + RegExp.$1 + ")" 
            }; 
        }
        // function expression         
        else if (/^var\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/m.exec(str)) {
            return {
                type: 'function-expr',
                name: RegExp.$1,
                params: RegExp.$2,
                firstline : firstline,
                string: RegExp.$1 + " (" + RegExp.$2 + ")"
            };
        } 
        // inline function         
        // /^(\w+) *: *function\s*\((.*)\)/
        else if (/^(\w+)\s*:\s*function\s*\(([^)]*)/m.exec(str)) {
            return {
                type: 'function-inline',
                name: RegExp.$1,
                params: RegExp.$2,
                firstline : firstline,
                string: RegExp.$1 + " (" + RegExp.$2 + ")"
            };
        }
        // prototype method        
        else if (/^(\w+)\.prototype\.(\w+)\s*=\s*function\s*\(([^)]*)\)/m.exec(str)) {
            return {
                type: 'prototype-method',
                constructor: RegExp.$1,
                name: RegExp.$2,
                params: RegExp.$3,
                firstline : firstline,
                string: RegExp.$1 + '.prototype.' + RegExp.$2 + " (" + RegExp.$3 + ")"
            };
        } 
        // prototype property        
        else if (/^(\w+)\.prototype\.(\w+)\s*=\s*([^\n;]+)/.exec(str)) {
            return {
                type: 'prototype-property',
                constructor: RegExp.$1,
                name: RegExp.$2,
                value: RegExp.$3,
                firstline : firstline,
                string: RegExp.$1 + '.prototype' + RegExp.$2
            };
        } 
        // method        
        else if (/^([\w.]+)\.(\w+)\s*=\s*function\s*\(([^)]*)\)/m.exec(str)) {
            return {
                type: 'method',
                receiver: RegExp.$1,
                name: RegExp.$2,
                params: RegExp.$3,
                firstline : firstline,
                string: RegExp.$1 + '.' + RegExp.$2 + "(" + RegExp.$3 + ")"
            };
        } 
        // property        
        else if (/^(\w+)\.(\w+)\s*=\s*([^\n;]+)/.exec(str)) {
            return {
                type: 'property',
                receiver: RegExp.$1,
                name: RegExp.$2,
                value: RegExp.$3,
                firstline : firstline,
                string: RegExp.$1 + '.' + RegExp.$2
            };
        } 
        // var declaration and init        
        else if (/^var +([\$\w]+)\s*=\s*([^\n;]+)/.exec(str)) {
            return {
                type: 'var-declaration-init',
                name: RegExp.$1,
                value: RegExp.$2,
                firstline : firstline,
                string: RegExp.$1
            };
        } 
        // simple var declaration
        else if (/^var +([\$\w]+) *;/.exec(str)) {
            return {
                type: 'var-declaration',
                name: RegExp.$1,
                value: "null",
                firstline : firstline,
                string: RegExp.$1
            };
        }
        // comment (single line)
        else if (/^\/\//.exec(str)) {
            return {
                type: 'comment',
                name : "(comment)",
                firstline : firstline,
                string : "(comment)"                
            };
        }
        // comment (multi line)
        else if (/^\/\*/.exec(str)) {
            return {
                type: 'comment',
                name : "(comment)",
                firstline : firstline,
                string : "(comment)"
            };
        }        
        // unknown
        else {
            return null;
        }
    }    
    
    exports.parseCode = parseCode;
    
});