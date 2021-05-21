import {fromLonLat, toLonLat} from 'ol/proj';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////  streetElementNode: this class represents      ////
////  every single point necessary to reproduce the ////
////  shape

export default class streetElementNode {
    constructor (id, coordenate, layer) {
        // Private
        var connections = [];    // Links who connect this element to others nodes

        // Public elements
        const feature = new Feature({ // The feature
	          geometry: new Point(fromLonLat([
	              coordenate[0],
                coordenate[1]
	          ]))
        });

        this.stop_info = {}; // TODO : private

        feature.parent = this; // Pass parent reference

        layer.getSource().addFeature(feature); // Gettin visible on map

        /////////////// Privileged methods

        this.getID = () => id;

        this.getCoordinates = () => {
            return feature.getGeometry().getCoordinates();
        };

        this.getLonLat = () => {
            return toLonLat(feature.getGeometry().getCoordinates());
        };

        this.setCoordinates = ( lonLat ) => {
            this.stop_info["stop_lon"] = lonLat[0];
            this.stop_info["stop_lat"] = lonLat[1];
            feature.getGeometry().setCoordinates(
                fromLonLat([
	                  lonLat[0],
                    lonLat[1]
	              ]));
            for( var i in connections ){
                connections[i].update(); // Update link
            }
        };

        this.setLayer = (new_layer) => {
            layer.getSource().removeFeature(feature);
            new_layer.getSource().addFeature(feature);
            layer = new_layer;
        };

        this.getType = () => { // Layer name is the element type
            return layer.name; // TODO: smarter type resolve
        };

        this.isValid = () => {
            if ( layer.getSource().getFeatureByUid(feature.ol_uid) )
                return true;
            else
                return false;
        };

        this.getFeatureUID = () => {
            return feature.ol_uid;
        };

        this.addConnection = (value) =>{
            // value: streetElementLink
            //verify if there are more than X connections
            connections.push(value);
        };

        this.getConnections = () => {
            return connections.slice(0); // copy
        };

        // TODO push, rotation
        this.removeConnection = (link) => {
            // link: streetElementLink
            if (this.isValid()){
                for (var i in connections ){ // TODO : use filter
                    if (connections[i].getID() == link.getID()){
                        connections.splice(i, 1);
                    }
                }
            }
        };

        // Terminate element
        this.terminate = () => {
            // delete feature // TODO
            // parent has to delete connections first

            // Terminate links:
            connections.slice(0).forEach(value =>{
                value.terminate(); // Terminate link
            });

            // Remove feature from map // set node invalid
            layer.getSource().removeFeature(feature);

        };
    }

    static isInstance (obj) {
        if (typeof(obj) == "object"){
            if (obj.constructor.name == streetElementNode.name){
                return true;
            }
        }
        console.log("The variable is not a " + streetElementNode.name + " instance");
        return false;
    }

    static distance (nodeA, nodeB) { // TODO distance between two nodes
        console.log("TODO distance between two nodes");
    }

    static get type () {
        return { // The only possible node types
            FORK: "fork",
            SHAPE: "shape",
            ENDPOINT: "endpoint",
            STOP: "stop"
        };
    }

    setStopInfo (stop_info){
        // @param: map: stop_info, a map with the stop info
        // TODO verify info
        this.stop_info = stop_info;
        if (stop_info['stop_lon'] && stop_info['stop_lat'])
            this.setCoordinates([stop_info['stop_lon'], stop_info['stop_lat']]);
        else {
            this.stop_info["stop_lon"] = this.getLonLat()[0];
            this.stop_info["stop_lat"] = this.getLonLat()[1];
        }
    }

    getStopInfo (){
        if (this.getType() == streetElementNode.type.STOP |
            this.getType() == streetElementNode.type.ENDPOINT){
            // [
            //     "stop_id",
            //     "stop_code",
            //     "stop_name",
            //     "stop_desc",
            //     "stop_lat",
            //     "stop_lon",
            //     "zone_id",
            //     "stop_url",  // page with a photo and info about TODO
            //     "location_type",
            //     "parent_station",
            //     "stop_timezone",
            //     "wheelchair_boarding"
            // ]
            // this.stop_info["stop_lon"] = this.getLonLat()[0];
            // this.stop_info["stop_lat"] = this.getLonLat()[1];
            return this.stop_info;
        } else {
            return {};
        }
    }
}

