/*jslint node:true */
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

var clone = require('clone'),
    typeDetect = require('type-detect'),
    deep = require('deep-get-set'),
    setOptions = {},
    setType,
    Obj;

/* Usage
 *
 * formData().model(Entity).get()
 * formData().model(Entity).getRequired()
 */

setOptions.list = function (obj, item) {
    if (item && item.enumValues) {
        obj.options = item.enumValues.map(function (enumValue) {
            return {
                label: enumValue,
                value: enumValue
            };
        });

        if (item.defaultValue) {
            obj.value = item.defaultValue;
        }
    } else {
        obj.options = [{
            label: 'Yes',
            value: 1
        }, {
            label: 'No',
            value: 0
        }];
    }
};

setOptions.number = function (obj, item) {
    obj.min = item.options.min;
    obj.max = item.options.max;
    obj.step = item.options.step;
};

setType = function (obj, item, options) {
    if (item.options.type === Boolean) {
        obj.type = 'radio';
        setOptions.list(obj);
    } else if (item.options.type === Number) {
        obj.type = 'number';
        setOptions.number(obj, item);
    } else if (item.options.type === Date) {
        obj.type = 'datetime';
    } else if (item.options.type === String && item.enumValues.length > 0) {
        if (item.enumValues.length < options.selectMinItems) {
            obj.type = 'radio';
        } else {
            obj.type = 'select';
        }
        setOptions.list(obj, item);
    } else if (item.options.type instanceof Array) {
        setType(obj, {
            options: {
                type: item.options.type[0].type
            },
            enumValues: item.options.type[0]['enum']
        }, options);
    } else if (item.options.type === String && /\.?password$/.test(item.path)) {
        obj.type = 'password';
    } else {
        obj.type = 'text';
    }
};

Obj = function (opts) {
    var self = this;
    if (!opts) {
        opts = {};
    }

    self.data = {};
    self.options = {
        // determines if we use a select or a list of radio buttons
        selectMinItems: +opts.selectMinItems || 5,
        // show fields that start with underscore
        showPrivate: opts.showPrivate || false
    };
};

Obj.prototype.options = null;
Obj.prototype.data = null;
Obj.prototype.itemValues = null;
Obj.prototype.mongooseModel = null;

Obj.prototype.model = function (mongooseModel) {
    var self = this,
        paths = mongooseModel.schema.paths,
        tree = mongooseModel.schema.tree;

    self.mongooseModel = mongooseModel;

    Object.keys(paths).forEach(function (name) {
        var item, obj;

        if (!self.data[name]) {
            self.data[name] = {};
        }
        obj = self.data[name];
        item = paths[name];

        if (!item) {
            return;
        }

        obj.required = item.isRequired || false;

        if (item.options.match) {
            // converts the  
            if (Array.isArray(item.options.match)) {
                obj.pattern = item.options.match[0].source;
            } else {
                obj.pattern = item.options.match.source;
            }
        }

        obj.name = item.path;
        obj.label = deep(tree, name + '.label') || obj.name.charAt(0).toUpperCase() + obj.name.substring(1).replace(/([A-Z])/g, ' $1');

        setType(obj, item, self.options);
    });
    return self;
};

Obj.prototype.values = function (data) {
    var self = this;
    self.itemValues = data;

    Object.keys(self.itemValues).forEach(function (field) {
        var obj;
        if (!self.data[field]) {
            self.data[field] = {};
        }
        obj = self.data[field];

        obj.name = field;
        obj.value = self.itemValues[field];

        if (!obj.label) {
            // create a (Camel Case) title from a camelCase string
            obj.label = (function (name) {
                var title = '',
                    i = 0,
                    wasUppercase = false;
                if (!name) {
                    return '';
                }
                for (i = 0; i < name.length; i += 1) {
                    if (/([A-Z0-9])/.test(name[i])) {
                        if (!wasUppercase) {
                            title += ' ';
                            wasUppercase = true;
                        }
                    } else {
                        wasUppercase = false;
                    }
                    title += name[i];
                }

                title = title.charAt(0).toUpperCase() + title.substring(1);
                return title;
            }(obj.name));
        }
        if (!obj.type) {
            switch (typeDetect(obj.value)) {
            case 'number':
                obj.type = 'number';
                break;
            case 'date':
                obj.type = 'datetime';
                break;
            case 'boolean':
                obj.type = 'radio';
                setOptions.list(obj, {});
                break;
            default:
                obj.type = 'text';
            }
        }
        // fix rendering of arrays/objects
        if (['textarea', 'eh-editor', 'hidden', 'text'].indexOf(obj.type) > -1) {
            if (typeof obj.value !== 'string') {
                obj.value = JSON.stringify(obj.value);
            }
        }
    });

    return self;
};

Obj.prototype.get = function (fields) {
    var self = this,
        list = fields ? fields.split(' ') : Object.keys(self.data);

    if (!fields && !self.showPrivate) {
        list = list.filter(function (field) {
            return (field.charAt(0) === '_' ? false : true);
        });
    }

    return list.map(function (field) {
        var fieldData, fieldType, fieldName, data, modelType;

        fieldData = field.split(':');
        fieldName = fieldData[0];
        fieldType = fieldData[1];

        //mongoose model is optional
        modelType = (self.mongooseModel && self.mongooseModel.schema.paths[fieldName].options.type) || null;

        data = self.data[fieldName] || {
            err: 'unable to find "' + fieldName + '"'
        };

        if (modelType === Boolean && data.value) {
            data.value = (data.value ? 1 : 0);
        }
        // overridden by the user
        if (fieldType) {
            data = clone(data);
            data.type = fieldType;
            if (fieldType === 'checkbox' && self.mongooseModel.schema.paths[fieldName].options.type === Boolean) {
                data.options = [{
                    label: data.label,
                    name: fieldName,
                    value: 1
                }];
                data.label = '';
            }
        }
        return data;
    });
};

Obj.prototype.getRequired = function () {
    var self = this,
        data = self.get();

    return data.filter(function (item) {
        return item.required;
    });
};

module.exports = function () {
    return new Obj();
};