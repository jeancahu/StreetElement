import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import {getLength as getGeometryLength} from 'ol/sphere.js';
import streetElementRoutingMachine from './streetElementRoutingMachine.js'; // TODO
import streetElementNode from './streetElementNode.js';

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

export default class streetElementLink { // Link between two nodes
    constructor (params = {}) {

        if (Number(params.id) != NaN) {} // Link indentificator
        else throw Error('Link ID: ' + params.id + ' is not a number');

        if (streetElementNode.isInstance(params.nodeA) &&
            params.nodeA.isValid()) {} // StreetElementNode object
        else throw Error('nodeA: ' + params.nodeA + ' is not a valid node');

        if (streetElementNode.isInstance(params.nodeB) &&
            params.nodeB.isValid()) {} // StreetElementNode object
        else throw Error('nodeB: ' + params.nodeB + ' is not a valid node');

        if (params.layer) {}     // OL-Layer object
        else throw Error('No layer provided');

        if (params.direction_layer) {}     // OL-Layer object
        else throw Error('No layer provided');

        ///////////////// private data
        var router = new streetElementRoutingMachine(); // FIXME remove TEMP
        var link_length = 'short'; // 'short' / 'long' / 'long-error' // TODO use var

        const routed = new LineString([
            params.nodeA.getCoordinates(),
            params.nodeB.getCoordinates()
        ]);

        const forward = new LineString([
            params.nodeA.getCoordinates(),
            params.nodeB.getCoordinates()
        ]);

        const reverse = new LineString([
            params.nodeB.getCoordinates(),
            params.nodeA.getCoordinates()
        ]);

        const feature_line = new Feature({
            geometry_forward: forward,
            geometry_reverse: reverse,
            name: 'Direction'
        });
        feature_line.setGeometryName('geometry_forward');
        feature_line.parent = this;

        var feature_routed = new Feature({
            geometry: routed,
            name: 'MultiLine'
        });
        feature_routed.parent = this;

        //////////////////////////////////////////////////////////// TODO
        // Calculates sphere distance, better than lineal this case
        var l_distance =
            Math.round(
                (getGeometryLength(forward)) * 100) / 100;

        if (l_distance < 120){
            //less than 120 meters, simple link
            link_length = 'short';
        } else {
            // a long distance between nodes needs routing
            try {
                link_length = 'long';
                router.route([
                    params.nodeA.getCoordinates(),
                    params.nodeB.getCoordinates()
                ]).then(
                    data => {
                        routed.setCoordinates(
                            data
                        );
                    }
                );
            } catch (err) {
                console.error('bad response on routing for long link');
                link_length = 'long-error';
            }
        }

        params.layer.getSource().addFeature(feature_routed);

        ///////////////////////////////////////////////////////////
        ////// Privileged methods

        this.getID = () => params.id;

        this.getNodes = () => {
            return [
                params.nodeA,
                params.nodeB
            ];
        };

        this.getPartner = (node) => {
            if ( node.getID() == params.nodeA.getID())
                return params.nodeB;
            else if ( node.getID() == params.nodeB.getID())
                return params.nodeA;
            return null; // else
        };

        this.isValid = () => {
            // both nodes should be valid for link to be valid
            if (params.layer.getSource().getFeatureByUid(feature_line.ol_uid) ||
                params.layer.getSource().getFeatureByUid(feature_routed.ol_uid))
                return params.nodeA.isValid() && params.nodeB.isValid();
            else return false;
        };

        this.update = (updateParams = {}) => { // Update figure on map
            forward.setCoordinates([
                params.nodeA.getCoordinates(),
                params.nodeB.getCoordinates()
            ]);
            reverse.setCoordinates([
                params.nodeB.getCoordinates(),
                params.nodeA.getCoordinates()
            ]);

            if ( link_length == 'short' )
                routed.setCoordinates([
                    params.nodeA.getCoordinates(),
                    params.nodeB.getCoordinates()
                ]);
            else if ( updateParams.routed ) {
                if ( link_length == 'long' ||
                     link_length == 'long-error') {
                    try {
                        link_length = 'long';
                        router.route([
                            params.nodeA.getCoordinates(),
                            params.nodeB.getCoordinates()
                        ]).then(
                            data => {
                                routed.setCoordinates(
                                    data
                                );
                            }
                        );
                    } catch (err) {
                        console.error('bad response on routing for long link');
                        link_length = 'long-error';
                        routed.setCoordinates([
                            params.nodeA.getCoordinates(),
                            params.nodeB.getCoordinates()
                        ]);
                    }
                }
            }
        };

        this.setDirectionFromNode = (node) => {
            if (node == params.nodeA){
                console.log("set_direction 0");
                feature_line.setGeometryName('geometry_forward');
            } else if (node == params.nodeB){
                console.log("set_direction 1");
                feature_line.setGeometryName('geometry_reverse');
            } else {
                console.error("Node:"+node.getID()+" is not linked by Link:"+params.id);
                return;
            }
            if (params.direction_layer.getSource().getFeatureByUid(feature_line.ol_uid)) {}
            else params.direction_layer.getSource().addFeature(feature_line);
        };

        this.hideDirection = () => {
            if (params.direction_layer.getSource().getFeatureByUid(feature_line.ol_uid))
                params.direction_layer.getSource().removeFeature(feature_line);
        };

        this.terminate = () => {
            // node: node who killed the link
            // delete feature // TODO
            // parent has to delete connections first

            if (params.layer.getSource().getFeatureByUid(feature_routed.ol_uid))
                params.layer.getSource().removeFeature(feature_routed);

            this.hideDirection();

            params.nodeA.removeConnection(this);
            params.nodeB.removeConnection(this);
        };
    }

    static isInstance (obj) {
        if (typeof(obj) == "object"){
            if (obj.constructor.name == streetElementLink.name){
                return true;
            }
        }
        console.log("The variable is not a " + streetElementLink.name + " instance");
        return false;
    }

    static get type () {
        return {
            LINK: "link",
            DIRECTION: "arrow"
        };
    }

    static getLinkBetween (nodeA, nodeB) {
        var result = nodeA.getConnections().filter(
            (link) => (link.getPartner(nodeA) == nodeB)
        );
        if (result.length > 1){
            throw Error('Nodes: '+nodeA.getID()+':'+
                        nodeB.getID()+'; more than one link between');
        } else if (result.length) {
            return result[0];
        } // else:
        return null;
    }

    static getLinksFromNode (node, exclude=[]) {
        var result = [];
        var links = node.getConnections();
        links.forEach((link) =>{
            //// for each link

            if (exclude.some((excluded_link) => {
                return link.getID() == excluded_link.getID();
            })){
                // ignore the link
            } else { // add the link
                result.push(link);
            }
            //// end for each link
        });
        return result;
    }

}
