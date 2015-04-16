/*jslint node:true, browser:true */
/*global describe, it */
'use strict';
/*
    Copyright 2015 Enigma Marketing Services Limited

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

var assert = require("assert"),
    formData = require('../lib'),
    Model = require('../fixtures/model');

describe('form data', function () {

    describe('Basic Tests', function () {
        it('should return all items', function () {
            var expected = [{
                    required: true,
                    name: 'title',
                    label: 'Title',
                    type: 'text'
                }, {
                    required: false,
                    name: 'slug',
                    label: 'Slug',
                    type: 'text'
                }],
                returned = formData().model(Model).get();

            assert.deepEqual(returned, expected);
        });

        it('should return required only', function () {
            var expected = [{
                    required: true,
                    name: 'title',
                    label: 'Title',
                    type: 'text'
                }],
                returned = formData().model(Model).getRequired();

            assert.deepEqual(returned, expected);
        });
    });

});