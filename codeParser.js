/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $ */


define(function (require, exports, module) {
    'use strict';
        

    /**
        Tries to analyze a string representing a js source
        @param {String} str The string representing the source code
        @returns {Object} An object representing the code
        
        Original regexps found in Dox.js
        https://github.com/visionmedia/dox/
    */    
    function parseCode(src) {
        
        //removing whitespace
        var str = src.replace(/^\s*/m, "");
        //str = str.split('\n')[0];
        
        // function statement
        if (/^function (\w+) *\(/.exec(str)) {
            return {
                type: 'function',
                name: RegExp.$1,
                string: RegExp.$1 + '()'
            };
        }
        // define        
        else if (/^define/.exec(str)) {
            return {
                type: 'define', 
                name: RegExp.$1,
                string: RegExp.$1 + '()'
            }; 
        }
        // function expression         
        else if (/^var *(\w+) *= *function/.exec(str)) {
            return {
                type: 'function-expr',
                name: RegExp.$1,
                string: RegExp.$1 + '()'
            };
        } 
        // inline function         
        else if (/^(\w+) *: *function/.exec(str)) {
            return {
                type: 'function-inline',
                name: RegExp.$1,
                string: RegExp.$1 + '()'
            };
        }
        // prototype method        
        else if (/^(\w+)\.prototype\.(\w+) *= *function/.exec(str)) {
            return {
                type: 'prototype-method',
                constructor: RegExp.$1,
                name: RegExp.$2,
                string: RegExp.$1 + '.prototype.' + RegExp.$2 + '()'
            };
        } 
        // prototype property        
        else if (/^(\w+)\.prototype\.(\w+) *= *([^\n;]+)/.exec(str)) {
            return {
                type: 'prototype-property',
                constructor: RegExp.$1,
                name: RegExp.$2,
                value: RegExp.$3,
                string: RegExp.$1 + '.prototype' + RegExp.$2
            };
        } 
        // method        
        else if (/^([\w.]+)\.(\w+) *= *function/.exec(str)) {
            return {
                type: 'method',
                receiver: RegExp.$1,
                name: RegExp.$2,
                string: RegExp.$1 + '.' + RegExp.$2 + '()'
            };
        } 
        // property        
        else if (/^(\w+)\.(\w+) *= *([^\n;]+)/.exec(str)) {
            return {
                type: 'property',
                receiver: RegExp.$1,
                name: RegExp.$2,
                value: RegExp.$3,
                string: RegExp.$1 + '.' + RegExp.$2
            };
        } 
        // var declaration and init        
        else if (/^var +([\$\w]+) *= *([^\n;]+)/.exec(str)) {
            return {
                type: 'var-declaration-init',
                name: RegExp.$1,
                value: RegExp.$2,
                string: RegExp.$1
            };
        } 
        // simple var declaration
        else if (/^var +([\$\w]+) *;/.exec(str)) {
            return {
                type: 'var-declaration*',
                name: RegExp.$1,
                value: "null",
                string: RegExp.$1
            };
        } 
        else {
            return null;
        }
    }    
    
    exports.parseCode = parseCode;
    
});