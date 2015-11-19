// Copyright 2015, EMC, Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = ipmiSdrPollerAlertJobFactory;
di.annotate(ipmiSdrPollerAlertJobFactory, new di.Provide('Job.Poller.Alert.Ipmi.Sdr'));
di.annotate(ipmiSdrPollerAlertJobFactory, new di.Inject(
    'Job.Poller.Alert',
    'Logger',
    'Util',
    'Assert',
    'Promise',
    '_',
    "Services.Waterline"
));
function ipmiSdrPollerAlertJobFactory(
    PollerAlertJob,
    Logger,
    util,
    assert,
    Promise,
    _,
    waterline
    ) {

    var logger = Logger.initialize(ipmiSdrPollerAlertJobFactory);

    /**
     *
     * @param {Object} options
     * @param {Object} context
     * @param {String} taskId
     * @constructor
     */
    function IpmiSdrPollerAlertJob(options, context, taskId) {
        assert.object(context);
        assert.uuid(context.graphId);

        var subscriptionArgs = [context.graphId, 'sdr'];

        IpmiSdrPollerAlertJob.super_.call(this, logger, options, context, taskId,
                '_subscribeIpmiCommandResult', subscriptionArgs);
    }
    util.inherits(IpmiSdrPollerAlertJob, PollerAlertJob);

    IpmiSdrPollerAlertJob.prototype._determineAlert = function _determineAlert(data) {
        return waterline.workitems.needByIdentifier(data.workItemId)
        .then(function (workitem) {
            var conf = workitem.config;
            if (_.has(conf, 'inCondition')) {
                conf.inCondition.discrete = _.transform(conf.inCondition.discrete, function (result, val, key) {
                    result[key.replace(/_/ig, '.')] = val;
                });
                conf.inCondition.threshold = _.transform(conf.inCondition.threshold, function (result, val, key) {
                    result[key.replace(/_/ig, '.')] = val;
                });
            } else {
                var inCondition = {
                    'discrete': {},
                    'threshold': {}
                }
                conf.inCondition = inCondition;
            }
            // Set the pollerName var
            data.pollerName = "sdr";

            var alerts = _.transform(data.sdr, function (results, val) {
                var alertObj;
                var sensorKey = val['sensorId'].replace(/_/ig, '.');
                var sdrType = val['sdrType'].replace(/_/ig, '.');
                //Check if sdrType is Discrete/Threshold
                if (sdrType == 'Discrete') {

                    var statesAsserted = val['statesAsserted'];
                    if (statesAsserted) {
                        alertObj = _.omit(data, 'sdr');
                        alertObj.reading = val;
                        alertObj.inCondition = true;
                        alertObj.node = data.node;
                        results.push(alertObj);

                        //update conf.inCondition.Discrete list
                        if (!_.has(conf.inCondition.discrete, sensorKey)) {
                            conf.inCondition.discrete[sensorKey] = {};
                        }

                        //add/edit the asseted states Asserted  in conf.inCondition
                        for (var key in statesAsserted) {
                            var statesAssertedEntry = statesAsserted[key].replace(/_/ig, '.');
                            conf.inCondition.discrete[sensorKey][statesAssertedEntry] = true;
                        }

                        //Iterate the inCondition.discrete[sensorKey] 
                        for (var condkey in conf.inCondition.discrete[sensorKey]) {
                            var is_faulted = false;
                            var statesAssertedEntry;
                            for (var key in statesAsserted) {
                                statesAssertedEntry = statesAsserted[key].replace(/_/ig, '.');
                                if (statesAssertedEntry == condkey) {
                                    is_faulted = true;
                                }
                            }
                            if (is_faulted) {
                                conf.inCondition.discrete[sensorKey][condkey] = true;
                            }
                            else {
                                conf.inCondition.discrete[sensorKey][condkey] = false;
                            }
                        }
                    }
                    else {
                        //check for previous condition
                        //if exist alert and clear
                        if (_.has(conf.inCondition.discrete, sensorKey)) {
                            for (var key in conf.inCondition.discrete[sensorKey]) {
                                //create an alert
                                if (conf.inCondition.discrete[sensorKey][key]) {
                                    alertObj = _.omit(data, 'sdr');
                                    alertObj.reading = val;
                                    alertObj.inCondition = false;
                                    alertObj.node = data.node;
                                    results.push(alertObj);
                                    conf.inCondition.discrete[sensorKey][key] = false;
                                }
                            }
                        }
                    }
                }
                else if (sdrType == 'Threshold') {
                    /* publish an alert if an active fault is detected (inCondition asserted) or
                     * if a fault has just transitioned from active to inactive (inCondition is not
                     * asserted, but conf.inCondition is).
                     */
                    var unavailableStatuses = ['Not Available', 'ns', 'No Reading',
                        'na', 'disabled', 'Disabled', 'Not Readable'];
                    var inCondition = val.status !== 'ok' &&
                        !_.contains(unavailableStatuses, val.status);
                    if (!_.has(conf.inCondition.threshold, sensorKey)) {
                        var doAlert = inCondition;
                    }
                    else {
                        var doAlert = inCondition || conf.inCondition.threshold[sensorKey];
                    }
                    if (doAlert) {
                        alertObj = _.omit(data, 'sdr');
                        alertObj.reading = val;
                        alertObj.inCondition = inCondition;
                        alertObj.node = data.node;
                        conf.inCondition.threshold[sensorKey] = inCondition;
                        results.push(alertObj);
                    }
                }
            });
            conf.inCondition.discrete = _.transform(conf.inCondition.discrete, function (result, val, key) {
                result[key.replace(/\./ig, '_')] = val;
            });
            conf.inCondition.threshold = _.transform(conf.inCondition.threshold, function (result, val, key) {
                result[key.replace(/\./ig, '_')] = val;
            });
            return [alerts, waterline.workitems.update({ id: data.workItemId }, { config: conf })];
        })
        .spread(function (alerts) {
            return _.isEmpty(alerts) ? undefined : alerts;
        })
        .catch(function (err) {
            logger.error(err.message, { error: err, data: data });
        });
    };

    return IpmiSdrPollerAlertJob;
}