// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

/**
 * Get all task schemas' id
 * @return {Array<String>} the array of schema Ids
 */
function _getAllSchemaIds() {
    var metaSchema = helper.require('/lib/task-data/schemas/rackhd-task-schema.json');
    var schemas = helper.requireGlob('/lib/task-data/schemas/*.json');
    return _.reduce(schemas, function(acc, schema) {
        if (schema.id !== metaSchema.id && schema.hasOwnProperty('describeJob')) {
            acc.push(schema.id);
        }
        return acc;
    }, []);
}

/**
 * Get all task schemas' id, this function is shared by all tasks and it will be called only once.
 * @return {Array<String>} the array of schema Ids
 */
var getAllSchemaIds = _.once(function() {
    return _getAllSchemaIds();
});

module.exports = {

    before: function (callback) {
        before(function () {
            callback(this);
        });
    },

    examples: function () {
        before(function () {
            expect(this.taskdefinition).to.be.ok;
            expect(this.taskdefinition).to.be.an.Object;
        });

        describe('expected properties', function() {
            it('should have a friendly name', function() {
                expect(this.taskdefinition).to.have.property('friendlyName');
                expect(this.taskdefinition.friendlyName).to.be.a('string');
            });

            it('should have an injectableName', function() {
                expect(this.taskdefinition).to.have.property('injectableName');
                expect(this.taskdefinition.injectableName).to.be.a('string');
            });

            it('should have an implementsTask', function() {
                expect(this.taskdefinition).to.have.property('implementsTask');
                expect(this.taskdefinition.implementsTask).to.be.a('string');
            });

            it('should have options', function() {
                expect(this.taskdefinition).to.have.property('options');
                expect(this.taskdefinition.options).to.be.an('Object');
            });

            it('should have properties', function() {
                expect(this.taskdefinition).to.have.property('properties');
                expect(this.taskdefinition.properties).to.be.an('Object');
            });

            it('should have a valid schemaRef', function() {
                //since now not all task definition has corresponding schema, so I cannot
                //enable this test case for all tasks
                //TODO: enable this test case for all tasks after all tasks have schema defined.
                if (this.taskdefinition.hasOwnProperty('schemaRef')) {
                    var schemaIds = getAllSchemaIds();
                    expect(schemaIds.indexOf(this.taskdefinition.schemaRef)).to.be.at.least(0);
                }
            });
        });
    }
};
