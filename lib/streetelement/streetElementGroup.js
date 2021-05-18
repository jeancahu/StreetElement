const streetElementLink   = require('./streetElementLink.js');
const streetElementNode   = require('./streetElementNode.js');
const streetElementAgency = require('./streetElementAgency.js');
const streetElementRoute  = require('./streetElementRoute.js');
const streetElementShape  = require('./streetElementShape.js');
const streetElementCalendar = require('./streetElementCalendar.js');
const streetElementTrip = require('./streetElementTrip.js');
const streetElementStopTime = require('./streetElementStopTime.js');

// Import all dependencies we need from OpenLayers
import Map from 'ol/Map';
import View from 'ol/View';
import OSM from 'ol/source/OSM';
import Tile from 'ol/layer/Tile';
import {defaults} from 'ol/control';
import { fromLonLat, toLonLat } from 'ol/proj';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Circle from 'ol/style/Circle';
import Stroke from 'ol/style/Stroke';
import Icon from 'ol/style/Icon';
import Vector from 'ol/layer/Vector';
import SourceVector from 'ol/source/Vector';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import {getLength as getGeometryLength} from 'ol/sphere';

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

class streetElementGroup {
    // This class rule all the other ones, it prevents
    // input parameters errors and orphan elements
    constructor (center=[0.0,0.0], constraintArea) {
        ////// Private data ///////////////////////////
        /////////////// map //// Network map //////////
        var history = [];      // GTFS state         //
        var layers = {};       // Network layers     //
        var lastSelect = null; // last node selected //
        ///////////////////////////////////////////////

        ////// Private methods //////
        var addLink = (nodeA, nodeB) => { // Internal
            // Creates a link connnection between two nodes
            if (nodeA.getID() == nodeB.getID()){
                return 1;} // Error

            if (nodeA.valid & nodeB.valid) {} //OK
            else {return 2;} // Error

            nodeA.getConnections().forEach((value, index)=>{
                if ( value.getPartner(nodeA).getID() == nodeB.getID() ){
                    return; // duplicate link
                }
            });
            nodeB.getConnections().forEach((value, index)=>{
                if ( value.getPartner(nodeB).getID() == nodeA.getID() ){
                    console.log("Half link error at :", value);
                    return; // half-link error
                }
            });

            const connection = new streetElementLink(
                this.links.length, // ID number
                nodeA, // First node
                nodeB, // Second node
                layers[streetElementLink.type.LINK], // always link layer
                layers[streetElementLink.type.DIRECTION] // direction layer
            );
            this.links.push(
                connection // add this link to the group
            );
            // Update link on nodes
            this.nodes[nodeA.getID()].addConnection(connection);
            this.nodes[nodeB.getID()].addConnection(connection);

            this.updateElementLayerByID(nodeA.getID());
            this.updateElementLayerByID(nodeB.getID());
            return connection.getID();
        }; // END addlink

        var addLayer = (type, color) => {
            // Add layers to map at the initialization
            var radius;
            var style;

            switch (type) {
            case streetElementNode.type.SHAPE: // Shape element, blue
                radius = 5;
                style =  new Style({
	                  image: new Circle({
	                      radius: radius, // 5 default
	                      fill: new Fill({color: color})
	                  })
                });
                break;
            case streetElementNode.type.STOP: // Stop element, red
                radius = 7;
                style =  new Style({
	                  image: new Circle({
	                      radius: radius, // 5 default
	                      fill: new Fill({color: color})
	                  })
                });
                break;
            case streetElementNode.type.FORK: // Intersec. violet
                radius = 5;
                style =  new Style({
	                  image: new Circle({
	                      radius: radius, // 5 default
	                      fill: new Fill({color: color})
	                  })
                });
                break;
            case streetElementNode.type.ENDPOINT: // Terminals, green
                radius = 5;
                style =  new Style({
	                  image: new Circle({
	                      radius: radius, // 5 default
	                      fill: new Fill({color: color})
	                  })
                });
                break;
            case 'select': // Terminals, green
                radius = 3;
                style =  new Style({
	                  image: new Circle({
	                      radius: radius, // 5 default
	                      fill: new Fill({color: color})
	                  })
                });
                break;
            case streetElementLink.type.LINK: // FIXME link, blue
                radius = 2;
                style = new Style({
                    stroke: new Stroke({
                        color: color,
                        width: 4.5,
	                  })
                });
                break;
            case streetElementLink.type.DIRECTION: // FIXME never executes
                style = function (feature) {
                    var geometry = feature.getGeometry();
                    var style = [];
                    console.log("-> add an arrow");
                    geometry.forEachSegment(function (start, end) {
                        var dx = end[0] - start[0];
                        var dy = end[1] - start[1];
                        var rotation = Math.atan2(dy, dx);
                        style.push(
                            new Style({
                                geometry: new Point(start),
                                image: new Icon({
                                    // src: 'assets/img/arrow.png',
                                    src: 'arrow.png',
                                    anchor: [-0.15, 0.5],
                                    rotateWithView: true,
                                    rotation: -rotation,
                                }),
                            })
                        );
                    });
                    return style;
                };
                break;
            default:
                console.log('Type: '+ type +' not found');
            }

            const vectorLayer = new Vector({
                source: new SourceVector(),
                style: style
            });
            vectorLayer.name = type; // Name the layer
            layers[type] = vectorLayer; // Add layer to obj
            this.map.addLayer(layers[type]); // Add layer to map
        }; // END addLayer

        ////// Privileged methods //////
        this.historyJSON = () => {
            return history.slice();
        };

        this.historyPush = (command) => { // TODO private method
            // command is a list with an external function and its arguments
            if (command[0] == "selectNodeByID" | // Process selectNodeByID
                command[0] == "unselectNode") {  // or unselectNode

                if (history[history.length -1][0] == "selectNodeByID" |
                    history[history.length -1][0] == "unselectNode") {
                    // only save the last selected node if there are not editions in between
                    this.historyPop();
                }
            }
            else
                if (command[0] == "setNodeCoordinatesByID" ) {

                    if (history[history.length -1][0] == "setNodeCoordinatesByID" &
                        history[history.length -1][1] == command[1]) {
                    // only save the last move for same node
                    this.historyPop();
                }
            }
            history.push(command);
        };

        this.historyLoad = (in_history) => {
            // Loads the history inputs user did to get the actual state
            // every time it loads, remakes all the history
            console.log("Load history");
            // TODO if method is not in class, error code
            in_history.forEach( (commad) => {
                this[commad[0]](...commad.slice(1, commad.length));
            });
        };

        this.historyString = () => {
            // Saves history as an Stringed array
            console.log("String history");
            var result = JSON.stringify(
                history
            ).replace(/\]\,\[/g,"],\n\t\t\t[");
            result = result.replace(/\[\[/,"[\n\t\t\t[");
            result = "const _streetElementGroupHistory = " + result;
            result = result.replace(/\]$/,"\n];\n");
            return result;
        };

        this.historyPop = function () { // TODO
            // Drops a line, the lastest added to the
            // history array
            console.log("Pop from history");
            history.pop();
        };

        this.addNode = (params) => {
            // Add a node to the group
            // params.coordinate: a single of coordinate, point
            // params.type: the element layer name

            if ( typeof(params) != 'object'){
                return false;
            }

            if (params.coordinate &&
                params.type){
                // Nothing to do
            } else { // Parameters are less than required
                return false;
            }

            if (params.nolink == true){
                // it makes the node independent and doesn't
                // create a link with the node behind
                this.selectNode(null); // internal doesn't history
            }

            if (params.type == streetElementNode.type.ENDPOINT |
                params.type == streetElementNode.type.STOP     |
                params.type == streetElementNode.type.SHAPE    |
                params.type == streetElementNode.type.FORK     )
            {
                // good type, continue
            } else {
                console.log("Bad node type on init");
                return 1; // error
            }

            if ( // Verify if there is another node with the same stop id
                params.type == streetElementNode.type.STOP &&
                    this.nodes.some(
                        (node) => node.getStopInfo().stop_id == params.stop_id)
            ){
                return false;
            } // If there is not we add the new node

            this.historyPush(["addNode",
                              params
                             ]);

            var new_node = new streetElementNode(
                this.nodes.length, // ID number
                params.coordinate, // coordinate
                layers[params.type] // layer
            );

            // If node has stop type, add stop info
            if (params.type == streetElementNode.type.STOP    |
                params.type == streetElementNode.type.ENDPOINT)
            {
                // Add the rest of the params as node_info
                new_node.setStopInfo(
                    params
                );
            }

            this.nodes.push(new_node);

            if (lastSelect){ // Connect nodes
                // TODO exceptions for endpoints
                addLink(lastSelect,
                        this.getLastElement
                       );
            }

            // The new element is the lastSelect now
            this.selectNode(this.getLastElement);
            return 0; // done
        };

        this.addShape = (shape_id, shape_segments) => {
            // TODO: verify segments are continuous

            this.historyPush(["addShape", shape_id, shape_segments]);

            // TODO: make shape a private attribute
            this.shapes.array.push(
                new streetElementShape(
                    shape_id,
                    shape_segments
                )
            );
        };

        this.removeShape = (shape_id) => {
            this.historyPush(["removeShape", shape_id]);
            console.log("Remove Shape, TODO");

            // This removes the shape from the array
            this.shapes.array = this.shapes.array.filter(shape => shape.getID() != shape_id);
        };

        this.addScheme = (service_id, trip_id) => {
            this.historyPush(["addScheme", service_id, trip_id]);
            this.services.array.filter(
                service => service.getID() == service_id
            )[0].addTrip(
                trip_id
            );
        };

        this.removeScheme = (service_id, trip_id) => {
            this.historyPush(["removeScheme", service_id, trip_id]);
            this.services.array.filter(
                service => service.getID() == service_id
            )[0].removeTrip(
                trip_id
            );
        };

        this.linkNodesByID = (nodeA_id, nodeB_id) => { // External
            this.historyPush(["linkNodesByID", nodeA_id, nodeB_id]);
            addLink (
                this.nodes[nodeA_id],
                this.nodes[nodeB_id]
            );
        };

        this.splitLinkByID = (link_id, coordinate, type) => {
            this.historyPush([
                "splitLinkByID",
                link_id,
                coordinate,
                type
            ]);
            // invalidate the link
            this.links[link_id].terminate();

            // TODO projection on the link to get a coordinate
            // TODO type node

            // add a Shape Node
            var new_node = new streetElementNode(
                this.nodes.length, // ID number
                coordinate, // coordinate
                layers[streetElementNode.type.SHAPE] // layer
            );

            this.nodes.push(new_node);

            // The new element is the lastSelect now
            this.selectNode(new_node);

            // Link with the previous node A
            addLink(new_node,
                    this.links[link_id].nodeA
                   );

            // Link with the previous node B
            addLink(new_node,
                    this.links[link_id].nodeB
                   );
        };

        this.changeNodeInfoByID = (node_id, info) => { // TODO improve
            this.historyPush([
                "changeNodeInfoByID",
                node_id,
                info
            ]);
            // { // input param: info::
            //     type: layer,
            //     stop_id: number,
            //     stop_name: text,
            //     stop_desc: text,
            // }
            // TODO verify the type
            if (info.type){
                this.nodes[node_id].setLayer(
                    layers[info.type]
                );
            }

            // verify the data
            var stop_info = {};
            if (info.stop_id){
                stop_info['stop_id'] = info.stop_id;
            }
            if (info.stop_name){
                stop_info['stop_name'] = info.stop_name;
            }
            if (info.stop_desc){
                stop_info['stop_desc'] = info.stop_desc;
            }
            if (info.stop_url){
                stop_info['stop_url'] = info.stop_url;
            }

            this.nodes[node_id].setStopInfo(
                stop_info
            );

            if(this.getLastSelectedNode().getID() ==
               node_id){
                // If is selected node then update popup info
                this.popup_content.stop_info = stop_info;
            }
        };

        this.deleteNodeByID = (value) => {
            // This one is easy because last in Array but
            // a point in middlen needs more logic
            var element = this.nodes[value];
            if (element.valid){
                console.log("valid element");
            } else {
                console.log("invalid element");
                return;
            }
            this.historyPush(["deleteNodeByID", value]);
            element.terminate(); // terminate element

            if( element.getConnections().length == 2 ){
                addLink(
                    element.getConnections()[0].getPartner(element),
                    element.getConnections()[1].getPartner(element)
                );
            }

            // Head pointer
            this.selectNode(this.getLastElement);
        };

        this.updateElementLayerByID = (element_id) => { // TODO
            if (this.nodes[element_id].getConnections().length > 2){
                // Intersection
                this.nodes[element_id].setLayer(layers["fork"]);
            }
        };

        this.getFeatureByUID = (ol_uid) => {
            var result = [];
            Object.entries(layers).forEach(([key, value]) => {
                if (value.getSource().getFeatureByUid(ol_uid)){
                    result.push(value.getSource().getFeatureByUid(ol_uid));
                }
            });
            return result.length ? result[0] : null;
        };

        this.selectNode = (element) => {
            if ( lastSelect ){
                if (element)
                {this.updateElementLayerByID(element.getID());}

                if (this.getFeatureByUID(lastSelect.getFeatureUID())){
                    layers["select"].getSource().removeFeature(
                        this.getFeatureByUID(lastSelect.getFeatureUID())
                    );
                }
            }
            lastSelect = element;
            if ( lastSelect ){
                if (this.getFeatureByUID(lastSelect.getFeatureUID())){
                    layers["select"].getSource().addFeature(
                        this.getFeatureByUID(lastSelect.getFeatureUID())
                    );
                }
            }
        };

        this.getLastSelectedNode = () => {
            return lastSelect; // FIXME
        };

        this.disableElementsByType = (type) =>{
            if (type == streetElementNode.type.ENDPOINT |
                type == streetElementNode.type.STOP     |
                type == streetElementNode.type.SHAPE    |
                type == streetElementNode.type.FORK     |
                type == streetElementLink.type.LINK     |
                type == streetElementLink.type.DIRECTION)
            {
                layers[type].setVisible(false);
            } else {
                console.log("Error: layer "+ type +" not found");
            }
        };

        this.enableElementsByType = (type) =>{
            if (type == streetElementNode.type.ENDPOINT |
                type == streetElementNode.type.STOP     |
                type == streetElementNode.type.SHAPE    |
                type == streetElementNode.type.FORK     |
                type == streetElementLink.type.LINK     |
                type == streetElementLink.type.DIRECTION)
            {
                layers[type].setVisible(true);
            } else {
                console.log("Error: layer "+ type +" not found");
            }
        };

        this.shapesToGTFS = () => {
            var shape_CSV = "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled\n";
            this.shapes.array.forEach(
                shape => {
                    //console.log(shape.getID());
                    var result_nodes_array = [];

                    shape.getSegments().forEach(
                        segment => {
                            if (result_nodes_array.length){
                                var tmp_array = streetElementShape.routeSegment(
                                    this.nodes[segment[0]], // node
                                    this.links[segment[1]]  // link
                                ).reverse();
                                tmp_array.pop(); // drop first element TODO
                                result_nodes_array.push(
                                    tmp_array.reverse()
                                );
                            }else{
                                result_nodes_array.push(
                                    streetElementShape.routeSegment(
                                        this.nodes[segment[0]], // node
                                        this.links[segment[1]]  // link
                                    )
                                );
                            }
                        }
                    );
                    var l_distance = 0;
                    result_nodes_array.flat().forEach(
                        // For each shape caculates distance
                        (node, key) => {
                            var coor = toLonLat(node.getCoordinates());
                            if ( key ){ // if node is not the first index != 0
                                var l_line = new LineString([
                                    result_nodes_array.flat()[key -1].getCoordinates(),
                                    node.getCoordinates()
                                ]);
                                // Calculates sphere distance, better than lineal this case
                                l_distance +=
                                    Math.round(
                                        (getGeometryLength(l_line) / 1000) * 100) / 100;
                            }
                            // Concatenates string as a line in shapes.txt
                            shape_CSV += String(shape.getID())+','+
                                String(coor[1])+','+String(coor[0])+
                                ','+key+','+l_distance+'\n';
                        }
                    );
                }
            );
            // Return the table as string
            return shape_CSV; // return a string object with GTFS table in
        };

        this.toJSON = () => { // Create a static data JSON with the whole info needed
            var result = {};
            result.agencies = [];
            this.agencies.array.forEach((agency) => {
                result.agencies.push(
                    // TODO: verify info
                    agency.getInfo()
                );
            });

            result.routes = [];
            this.routes.array.forEach((route) => {
                result.routes.push(
                    route.getInfo()
                );
            });

            result.services = [];
            this.services.array.forEach((service) => {
                result.services.push(
                    service.getInfo()
                );
            });

            result.trips = [];
            this.trips.array.forEach((trip) => {
                result.trips.push(
                    trip.getInfo()
                );
            });

            result.stopTimes = [];
            this.stopTimes.array.forEach((stoptime) => {
                result.stopTimes.push(
                    stoptime.getInfo()
                );
            });

            result.shapes = [];
            this.shapes.array.forEach((shape) => {
                result.shapes.push(
                    shape.getInfo()
                );
            });

            // Stops info // TODO

            return result;
        };
        ////// END Privileged methods //////

        ////// Public data //////
        this.selected_action = 'select'; // TODO, private
        this.selected_node_type = 'shape'; // TODO, private

        this.popup_content = {
            id: null,
            type: null,
            connections: null,
            geo_lon: '',
            geo_lat: '',
            stop_info: {}
        };


        this.nodes     = []; // could it to be private? // TODO
        this.links     = []; // could it to be private? // TODO

        //////////////////////////////////////////////////// Map section /////////////////////////
        this.map = new Map({ // FIXME include in a function
            controls: defaults(
                {attribution: false}),
            layers: [
	              new Tile({
	                  source: new OSM(),
	              }),
	              //vectorLayer,
            ],
            keyboardEventTarget: document,
            //overlays: [overlay_node_info],
            // target: 'map_container', // It shows coordinates on page
            view: new View({
                center: fromLonLat(center),
                zoom: 12,
                // [minx,miny,max,may]
                extent: constraintArea,
            }),
        });

        this.map.on('click', (event) => {
            var coordinate = toLonLat(event.coordinate);
            var feature_onHover = this.map.forEachFeatureAtPixel(
                event.pixel,
                function(feature, layer)
                {
                    return feature;
                });

            ////////////////////////// create shape ////////////////

            if ( feature_onHover ){
                if (streetElementLink.isInstance(
                    feature_onHover.parent))
                { // if element is a link
                    if (feature_onHover.parent.oneshot){
                        feature_onHover.parent.oneshot(
                            feature_onHover.parent.getID()
                        );
                        feature_onHover.parent.oneshot = undefined;
                        return; // end execution
                    }
                }
            }

            /////////////////////  end create shape ////////////////

            switch(this.selected_action) {
            case "remove":
                // Click on element to remove
                if ( feature_onHover ){
                    if (streetElementNode.isInstance(
                        feature_onHover.parent)
                       ){ // if element is a node
                        this.deleteNodeByID(
                            feature_onHover.parent.getID());
                    }
                }
                break;

            case "add":
                if (feature_onHover){
                    if (streetElementNode.isInstance(
                        feature_onHover.parent)
                       ){ // if element is a node
                        // Link a node with other by ID
                        this.linkNodesByID(
                            feature_onHover.parent.getID(),
                            this.getLastSelectedNode().getID()
                        );
                        this.selectNodeByID(
                            feature_onHover.parent.getID()
                        );
                    }
                } else {
                    this.addNode({
                        'coordinate': coordinate,
                        'type': this.selected_node_type
                    });
                }
                break;

            case "split":
                console.log("Split a line");
                if (feature_onHover){
                    if (streetElementLink.isInstance(
                        feature_onHover.parent)
                       ){
                        // It is a Link
                        this.splitLinkByID(
                            feature_onHover.parent.getID(),
                            coordinate,
                            this.selected_node_type
                        );
                    }
                } else {
                    // does nothing
                    console.log("Nothing to split");
                }
                break;

            case "cut":
                console.log("Remove a link");
                if (feature_onHover){
                    if (streetElementLink.isInstance(
                        feature_onHover.parent)
                       ){ // if element is a Link
                        this.deleteLinkByID(
                            feature_onHover.parent.getID()
                        );
                    }
                } else {
                    // does nothing
                    console.log("Nothing to split");
                }
                break;

            case "move":
                if (this.getLastSelectedNode()){
                    this.setNodeCoordinatesByID(
                        this.getLastSelectedNode().getID(),
                        coordinate
                    );
                }

                // update popup position on map
                if ( this.map.getOverlayById('popup_node_info').getPosition() ) {
                    this.map.getOverlayById('popup_node_info').setPosition(
                        this.getLastSelectedNode().getCoordinates());
                }

                break;

            case "select":
                if (feature_onHover){ // if element exists
                    if (streetElementNode.isInstance(
                        feature_onHover.parent)
                       ){ // if element is a node
                        if (feature_onHover.parent.getID() ==
                            this.getLastSelectedNode().getID()){
                            // already selected
                            this.map.getOverlayById('popup_node_info').setPosition(
                                feature_onHover.parent.getCoordinates());
                            break;
                        } else {
                            // select the new node
                            this.selectNodeByID(feature_onHover.parent.getID());
                        }
                        // clear the name input
                        document.getElementById("ol_in_stop_name").value = '';
                        this.popup_content.id =
                            feature_onHover.parent.getID();
                        this.popup_content.type =
                            feature_onHover.parent.getType();
                        this.popup_content.connections =
                            feature_onHover.parent.getConnections().length;
                        this.popup_content.stop_info =
                            feature_onHover.parent.getStopInfo();

                        this.map.getOverlayById('popup_node_info').setPosition(
                            feature_onHover.parent.getCoordinates()
                        );
                    }
                }
                else {
                    this.map.getOverlayById('popup_node_info').setPosition(
                        undefined
                    );
                }
                break;

            default:
                this.map.getOverlayById('popup_node_info').setPosition(
                    undefined
                );
                this.unselectNode();
                console.log("undefined action");
            }
        });

        ///////////////////////////////////////////////// END Map section /////////////////////////

        this.shapes    = {array: []};
        this.agencies  = {array: []};
        this.services  = {array: []};
        this.routes    = {array: []};
        this.trips     = {array: []};
        this.stopTimes = {array: []};

        ////// END Public data //////

        // Add layers
        addLayer(streetElementLink.type.LINK,        "#585CCB"); // links between nodes
        addLayer(streetElementNode.type.SHAPE,       "#585CCB");
        addLayer(streetElementNode.type.FORK,        "#A46FF5");
        addLayer(streetElementNode.type.STOP,        "#DA1033");
        addLayer(streetElementNode.type.ENDPOINT,    "green");
        addLayer(streetElementLink.type.DIRECTION,   "yellow"); // link direction
        addLayer("select",                           "yellow");
    } ////// END streetElementGroup constructor //////

    ////// Public methods //////

    static isInstance ( obj ){
        if (typeof(obj) == "object"){
            if (obj.constructor.name == streetElementGroup.name){
                return true;
            }
        }
        console.log("The variable is not a " + streetElementGroup.name + " instance");
        return false;
    }

    // Method to get the amount of nodes
    get length (){
        return this.nodes.length;
    }

    nodesBetween(nodeA, nodeB){
        if ( streetElementNode.isInstance(nodeA) &
             streetElementNode.isInstance(nodeB) ) {
            console.log("both are nodes");
        } else {
            console.log("bad arguments");
        }
    }

    addAgency(agency_id,
              agency_name,
              agency_url,
              agency_timezone,
              agency_lang,
              agency_phone,
              agency_fare_url,
              agency_email
             ) {

        var agency = new streetElementAgency (
            agency_id,
            agency_name,
            agency_url,
            agency_timezone,
            agency_lang,
            agency_phone,
            agency_fare_url,
            agency_email
        );

        this.historyPush([
            "addAgency",
            agency_id,
            agency_name,
            agency_url,
            agency_timezone,
            agency_lang,
            agency_phone,
            agency_fare_url,
            agency_email
        ]);

        this.agencies.array.push(agency);

        return true; // TODO
    }

    removeAgency (agency_id
                  ){
        this.historyPush([
            "removeAgency",
            agency_id
        ]);

        // This removes the agency from the list
        this.agencies.array = this.agencies.array.filter(agency => agency.getID() != agency_id);

    }

    addService (service_info
               ){
        // Verify data
        if ( typeof(service_info.monday) == 'boolean'){} else { return 1; }
        if ( typeof(service_info.tuesday) == 'boolean'){} else { return 1; }
        if ( typeof(service_info.wednesday) == 'boolean'){} else { return 1; }
        if ( typeof(service_info.thursday) == 'boolean'){} else { return 1; }
        if ( typeof(service_info.friday) == 'boolean'){} else { return 1; }
        if ( typeof(service_info.saturday) == 'boolean'){} else { return 1; }
        if ( typeof(service_info.sunday) == 'boolean'){} else { return 1; }

        this.historyPush([
            "addService",
            service_info
        ]);

        this.services.array.push(
            new streetElementCalendar(
                service_info
            )
        );

        return 0;
    }

    removeService (service_id
                  ){
        this.historyPush([
            "removeService",
            service_id
        ]);

        // This removes the service from the array
        this.services.array = this.services.array.filter(service => service.getID() != service_id);
    }

    addRoute(route_id,
             agency_id,
             route_short_name,
             route_long_name,
             route_type
             ) {

        var route = new streetElementRoute (
            route_id,
            agency_id,
            route_short_name,
            route_long_name,
            route_type
        );

        this.historyPush([
            "addRoute",
            route_id,
            agency_id,
            route_short_name,
            route_long_name,
            route_type
        ]);

        this.routes.array.push(route);

        return true; // TODO
    }

    removeRoute (route_id) {
        this.historyPush(["removeRoute", route_id]);
        console.log("Remove Route, TODO");

        // This removes the route from the array
        this.routes.array = this.routes.array.filter(route => route.getID() != route_id);
    }

    addTrip(params) {
        if ( typeof(params) != 'object'){
            return false;
        }

        if (params.route_id &&
            params.trip_id &&
            params.direction_id &&
            params.shape_id){
            var trip = new streetElementTrip(
                params.route_id, // Route object
                params.trip_id,
                params.direction_id,
                params.shape_id  // Shape object
            );
        } else { // Parameters are less than required
            return false;
        }

        this.historyPush([
            "addTrip",
            params
        ]);

        this.trips.array.push(trip);

        return true;
    }

    removeTrip (trip_id) {
        this.historyPush(["removeTrip", trip_id]);
        console.log("Remove Trip, TODO");

        // This removes the trip from the array
        this.trips.array = this.trips.array.filter(trip => trip.getID() != trip_id);
    }

    addStopTime (trip_id,  // Trip object
                 arrival_time,
                 departure_time,
                 stop_id  // Stop object
                ) {
        var stoptime = new streetElementStopTime(
            trip_id,  // Trip object
            arrival_time,
            departure_time,
            stop_id  // Stop object
        );

        this.historyPush([
            "addStopTime",
            trip_id,  // Trip object
            arrival_time,
            departure_time,
            stop_id  // Stop object
        ]);

        this.stopTimes.array.push(stoptime);

        return true; // TODO
    }

    removeStopTime = (trip_id, stop_id) => {
        this.historyPush(["removeStopTime", trip_id, stop_id]);
        console.log("Remove StopTime, TODO");

        // This removes the stoptime from the array
        this.stopTimes.array = this.stopTimes.array.filter(
            stoptime => ( stoptime.getID() != stop_id | stoptime.getInfo().trip_id != trip_id));
    }

    unselectNode () { // for user use
        this.historyPush(["unselectNode"]);
        this.selectNode(null);
    }

    selectNodeByID ( node_id ){ // External // TODO verify data
        this.historyPush(["selectNodeByID", node_id]);
        this.selectNode(this.nodes[node_id]);
    }

    setNodeCoordinatesByID (node_id, coordinates){ // External
        this.historyPush([
            "setNodeCoordinatesByID",
            node_id,
            coordinates
        ]);
        this.nodes[node_id].setCoordinates(coordinates);
    }

    // Return the streetElementNode last object got in Array
    get getLastElement (){
        var decrem = 1;
        // Change this while FIXME:
        while (this.nodes[this.nodes.length-decrem].valid != true) {
            decrem = decrem + 1;
            if ( this.nodes.length-decrem < 0 ){
                return null;
            }
        }
        return this.nodes[this.nodes.length-decrem];
    }

    deleteLinkByID (link_id){ // TODO: move to link.terminate
        this.historyPush([
            "deleteLinkByID",
            link_id
        ]);
        this.links[link_id].terminate();
    }

    deleteLastElement (){
        if (this.getLastElement){
            this.deleteNodeByID (this.getLastElement.getID());
        } else {
            console.log("There are no valid nodes in the vector");
        }
    }
}

module.exports = streetElementGroup;
