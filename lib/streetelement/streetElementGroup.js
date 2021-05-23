import streetElementLink from './streetElementLink.js';
import streetElementNode from'./streetElementNode.js';
import streetElementAgency from './streetElementAgency.js';
import streetElementRoute  from './streetElementRoute.js';
import streetElementShape  from './streetElementShape.js';
import streetElementCalendar from './streetElementCalendar.js';
import streetElementTrip from './streetElementTrip.js';
import streetElementStopTime from './streetElementStopTime.js';

// Import all dependencies we need from OpenLayers
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import OSM from 'ol/source/OSM.js';
import Tile from 'ol/layer/Tile.js';
import {Control, Attribution, FullScreen, ScaleLine, defaults as defaultsControl } from 'ol/control.js';
import {Select, Translate, defaults as defaultsInteractions} from 'ol/interaction.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Circle from 'ol/style/Circle.js';
import Stroke from 'ol/style/Stroke.js';
import Icon from 'ol/style/Icon.js';
import Vector from 'ol/layer/Vector.js';
import SourceVector from 'ol/source/Vector.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import {getLength as getGeometryLength} from 'ol/sphere.js';

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

export default class streetElementGroup {
    // This class rule all the other ones, it prevents
    // input parameters errors and orphan elements
    constructor (center=[0.0,0.0], constraintArea) {
        ////// Private data ///////////////////////////////////////
        /////////////// map //////////////// Network map //////////
        var history = [];               // GTFS state            //
        var layers = {};                // Network layers        //
        var mode = 'select';            // Mode sEG it's working //
        ///////////////////////////////////////////////////////////

        ////// Private methods //////
        var addLink = (nodeA, nodeB) => { // Internal
            // Creates a link connnection between two nodes
            if (nodeA.getID() == nodeB.getID()){
                return 1;} // Error

            var nodea_links_nodeb = false;
            var nodeb_links_nodea = false;

            if (nodeA.getConnections().map(conn => conn.getPartner(nodeA)).some(
                node => node.getID() == nodeB.getID())){
                // NodeA is linked to NodeB
                nodea_links_nodeb = true;}

            if (nodeB.getConnections().map(conn => conn.getPartner(nodeB)).some(
                node => node.getID() == nodeA.getID())){
                // NodeB is linked to NodeA
                nodeb_links_nodea = true;}

            if ( nodeb_links_nodea && nodea_links_nodeb ){
                // Already linked
                return 0;
            } else if ( nodeb_links_nodea || nodea_links_nodeb ) {
                throw new Error('Half link '+[nodeA.getID(),nodeB.getID()].join());
            } // Error

            try {
                if (nodeA.isValid() && nodeB.isValid()) {} //OK
                else {
                    throw new Error('non valid nodes '+[nodeA.getID(),nodeB.getID()].join());
                }
            } catch (err) {
                console.error(err);
            }

            const connection = new streetElementLink({
                id:                this.links.length, // ID number
                nodeA:             nodeA, // First node
                nodeB:             nodeB, // Second node
                layer:             layers[streetElementLink.type.LINK], // always link layer
                direction_layer:   layers[streetElementLink.type.DIRECTION] // direction layer
            });
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
            case streetElementLink.type.DIRECTION:
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
        }; // END addLayer

        ////// Privileged methods //////
        this.getMode = () => {
            return mode;
        };

        this.setMode = (new_mode='select') => {
            mode = new_mode;
            switch(mode) {
            case 'shape':
                console.log('shape mode settings');
                map_select_nodes.setActive(false);
                map_select_links.setActive(false);
                break;

            case 'add':
                console.log('add');
                map_select_nodes.setActive(false);
                map_select_links.setActive(false);
                break;

            case 'select':
            case 'remove':
                console.log('select/remove mode settings');
                map_select_nodes.setActive(true);
                map_select_links.setActive(false);
                break;

            case 'split':
            case 'cut':
                console.log('split/cut mode settings');
                map_select_nodes.setActive(false);
                map_select_links.setActive(true);
                break;

            default:
                console.log('default settings');
                // Activates map select nodes
                mode = 'select';
                map_select_nodes.setActive(true);
                map_select_links.setActive(false);
            }
        };

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
                try{
                    this[commad[0]](...commad.slice(1, commad.length));
                } catch (err) {
                    console.error(err);
                }
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

            if ( params.stop_id == undefined ){
                params.stop_id = this.nodes.length;
            }

            if ( // Verify if there is another node with the same stop id
                params.type == streetElementNode.type.STOP &&
                    this.nodes.some(
                        (node) => node.getStopInfo().stop_id == params.stop_id)
            ){
                return false;
            } // If there is not we add the new node

            var new_node = new streetElementNode(
                this.nodes.length, // ID number
                params.coordinate, // coordinate
                layers[params.type] // layer
            );

            this.historyPush(["addNode",
                              params
                             ]);

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

            if (this.getLastSelectedNode()){ // Connect nodes
                try { addLink(this.getLastSelectedNode(),
                              new_node);
                } catch (err) {
                    throw new Error("add link: "+this.getLastSelectedNode().getID()+
                                    ' : '+new_node + '\n' + err.message);
                }
            }

            // The new element is the LastSelectNode now
            // keeps only the new element
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

            // The new element is the LastSelect now
            this.selectNode(new_node);

            // Link with the previous node A
            addLink(new_node,
                    this.links[link_id].getNodes()[0]
                   );

            // Link with the previous node B
            addLink(new_node,
                    this.links[link_id].getNodes()[1]
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

            if (info.type){
                this.nodes[node_id].setLayer(
                    layers[info.type]
                );
            }

            // verify the data
            var stop_info = {};

            if (info.stop_id &&
                info.stop_name &&
                info.stop_desc &&
                info.stop_url){
                // TODO check
            }

            this.nodes[node_id].setStopInfo(
                info
            );

            if(this.getLastSelectedNode().getID() ==
               node_id){
                // If is selected node then update popup info
                this.updatePopup();
            }
        };

        this.deleteNodeByID = (value) => {
            // This one is easy because last in Array but
            // a point in middlen needs more logic
            var element = this.nodes[value];
            if (!element.isValid()){
                console.warn("Invalid element "+element.getID());
                return;
            }
            this.historyPush(["deleteNodeByID", value]);

            var deletedNodePartners = element.getConnections()
                .map(conn => conn.getPartner(element));

            element.terminate(); // terminate element

            if( deletedNodePartners.length == 2 )
                addLink(
                    deletedNodePartners[0],
                    deletedNodePartners[1]
                );

            // unselectNode
            this.selectNode(null);
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

        this.updatePopup = () =>  {
            if (this.getLastSelectedNode() != null){ // update popup info
                this.popup_content.id =
                    this.getLastSelectedNode().getID();
                this.popup_content.type =
                    this.getLastSelectedNode().getType();
                this.popup_content.connections =
                    this.getLastSelectedNode().getConnections().length;
                this.popup_content.stop_info =
                    this.getLastSelectedNode().getStopInfo();
            }
        };

        this.selectNode = (element) => {
            this.updatePopup();
            if ( this.getLastSelectedNode() ){
                if (element)
                    this.updateElementLayerByID(element.getID());
            }
            map_select_nodes.getFeatures().clear(); // deselect extra picks

            if (element)
            map_select_nodes.getFeatures().push(this.getFeatureByUID(element.getFeatureUID()));
        };

        this.getLastSelectedNode = () => {
            if (map_select_nodes.getFeatures().getArray().length){
                return map_select_nodes.getFeatures().getArray().reverse()[0].parent;
            }
            return null;
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

        this.stopsToGTFS = () => {
            var stops_CSV_cols = "stop_id,stop_code,stop_name,stop_desc,stop_lat,\
stop_lon,zone_id,stop_url,location_type,\
parent_station,stop_timezone,wheelchair_boarding".split(',');
            var result = new String(this.nodes.
                filter(node => node.isValid() ).
                filter(node => node.getType() == streetElementNode.type.STOP
                       || node.getType() == streetElementNode.type.ENDPOINT ).
                map( node => // new list with all nodes
                    stops_CSV_cols.map(
                        stop_col => node.getStopInfo()[stop_col] ? node.getStopInfo()[stop_col] : "" )
                        .join()).join('\n'))+'\n';
            // Return the table as string
            return [stops_CSV_cols.join(), result].join('\n'); // return a string object with GTFS table in
        };


        this.shapesToGTFS = () => {
            var shape_CSV = "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled\n";
            try {
            this.shapes.array.forEach(
                shape => {
                    var result_nodes_array = [
                        [this.nodes[shape.getSegments()[0][0]]] // First node
                    ];
                    shape.getSegments().forEach(
                        segment => {
                            try{
                                var temp_nodes_array =
                                    streetElementShape.routeSegment(
                                        this.nodes[segment[0]], // node
                                        this.links[segment[1]]  // link
                                    ).reverse();
                            } catch (err) {
                                throw ("bad response: nodeID: "+segment[0]+", LinkID: "+segment[1]+
                                       "; are valid? "+
                                       this.nodes[segment[0]].isValid() + ' : ' + this.links[segment[1]].isValid()
                                      );
                            }
                            temp_nodes_array.pop(); // Drop first element:

                            result_nodes_array.push(
                                temp_nodes_array.reverse()
                            );
                        }
                    );

                    console.log(result_nodes_array);

                    var l_distance = 0;
                    result_nodes_array.flat().forEach(
                        // For each shape caculates distance
                        (node, key) => {
                            if (!node) throw ("bad node at "+shape.getID());
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
            } catch (err) {
                console.error(err);
            }
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

        // Add layers
        addLayer(streetElementLink.type.LINK,        "#585CCB"); // links between nodes
        addLayer(streetElementNode.type.SHAPE,       "#585CCB");
        addLayer(streetElementNode.type.FORK,        "#A46FF5");
        addLayer(streetElementNode.type.STOP,        "#DA1033");
        addLayer(streetElementNode.type.ENDPOINT,    "green");
        addLayer(streetElementLink.type.DIRECTION,   "yellow"); // link direction
        addLayer("select",                           "yellow");

        var map_select_nodes = new Select({
            'filter': (feature) => {
                if (feature.parent) return streetElementNode.isInstance(feature.parent);
                else return false;
            },
            'hitTolerance': 15
        });

        map_select_nodes.on('select', event => {
            this.updatePopup();
            if(event.deselected.length){
                if(!event.selected.length){
                    this.map.getOverlayById('popup_node_info').setPosition(
                        undefined
                    );
                    // there are deselected && selected == []
                    this.historyPush(["unselectNode"]);
                    return;
                }
            }
            // there are new selected

            if (mode == 'remove'){
                this.deleteNodeByID(
                    event.selected[0].parent.getID());
                return;
            }

            if (mode == 'select')
                this.map.getOverlayById('popup_node_info').setPosition(
                    event.selected[0].parent.getCoordinates());

            this.selectNodeByID(event.selected[0].parent.getID());

            if (event.target.getFeatures().getLength() > 1) {
                this.map.getOverlayById('popup_node_info').setPosition(
                    undefined
                );
            }
        });

        var map_select_links = new Select({
            'layers': [layers[streetElementLink.type.LINK]],
            'hitTolerance': 15
        });
        map_select_links.setActive(false); // inactive by default

        map_select_links.on('select', event => {
            if (mode == 'cut' && event.selected.length) {
                console.log("Remove a link");
                        this.deleteLinkByID(
                            event.selected[0].parent.getID());
            } else if (mode == 'split' && event.selected.length) {
                console.log("Split a line");
                // It is a Link
                this.splitLinkByID(
                    event.selected[0].parent.getID(),
                    toLonLat(event.mapBrowserEvent.coordinate),
                    this.selected_node_type
                );
            }
            // clear features always
            event.target.getFeatures().clear();
        });

        // map_select.setActive(true) // activar el select
        // bundle.o_se_group.map_select.on('select', (event) => console.log(event))
        // bundle.o_se_group.map.getLayers().getArray().filter(layer => layer.name == 'shape')[0].getSource().getFeatureByUid(9287).parent.terminate()
        // bundle.o_se_group.map_select.getFeatures().pop().ol_uid
        // bundle.o_se_group.map_select.setActive(true)
        // bundle.o_se_group.map_select_nodes.getFeatures().push(bundle.o_se_group.getFeatureByUID(bundle.o_se_group.getLastSelectedNode().getFeatureUID()))
        // bundle.o_se_group.map_select_nodes.getFeatures().clear() // flush the array

        var map_translate = new Translate({
            features: map_select_nodes.getFeatures(),
        });

        map_translate.on('translateend', event => {

            // TODO update nodes when one node drops over another
            //var coordinate = toLonLat(event.coordinate);
            var data = this.map.forEachFeatureAtPixel(
                event.mapBrowserEvent.pixel,
                function(feature, layer)
                {
                    return [feature, layer];
                },
                {
                    hitTolerance: 15,
                });

            if (data) {
                console.log(data);
            }

            // refresh all nodes position
            event.features.getArray().forEach(feature => {
                this.setNodeCoordinatesByID(
                    feature.parent.getID(),
                    feature.parent.getLonLat()
                );
            });
        });

        map_translate.on('translating', event => {
            this.updatePopup();
            event.features.getArray().forEach(feature => {
                this.nodes[feature.parent.getID()].setCoordinates(
                    feature.parent.getLonLat());
            });
        });

        map_translate.on('translatestart', event => {
            this.map.getOverlayById('popup_node_info').setPosition(
                undefined
            );
        });

        this.map_select_nodes = map_select_nodes; // FIXME TEMP
        this.map_select_links = map_select_links; // FIXME TEMP
        this.map_translate = map_translate; // FIXME TEMP

        this.map = new Map({ // FIXME include in a function
            interactions: defaultsInteractions().extend([
                map_select_nodes,
                map_select_links,
                map_translate
            ]),
            controls: defaultsControl(
                {attribution: false}).extend([
                    new Attribution({
                        collapsible: false,
                    })
                    ,
                    new FullScreen(
                        // {source: 'fullscreen-view'} // TODO should become from outside class
                    ),
                    new ScaleLine() // SI by default
                ]),
            layers: [
	              new Tile({
	                  source: new OSM(),
	              }),
            ].concat(Object.values(layers)),
            keyboardEventTarget: document,
            view: new View({
                center: fromLonLat(center),
                zoom: 12,
                // [minx,miny,max,may]
                extent: constraintArea,
            }),
        });

        this.map.getControls().getArray().filter(
            control => control.element.className.split(
                ' ')[0] == 'ol-attribution')[0].element.innerHTML =
            "<ul><li> \
                <a href=\"https://github.com/jeancahu/GTFS_shapes_editor_JS\" \
                target=\"_blank\">Shape Editor</a> \
                | © <a href=\"https://www.openstreetmap.org/copyright\" \
                target=\"_blank\">OpenStreetMap</a> contributors.</li></ul><button \
                type=\"button\" title=\"Attributions\"><span \
                class=\"ol-attribution-expand\">i</span></button>";

        // Add control to map
        this.addMapControl = (documentElement) => {
            if (documentElement){
                this.map.addControl(
                    new Control({
                        element: documentElement
                    })
                );
            } else {
                console.error('No a documentElement');
            }
        };

        // TODO
        // this.map.on('pointermove', event => this.pointer.coordinate =
        //             toLonLat(event.coordinate).map(coor => coor.toPrecision(8)));
        this.map.on('dblclick', event => event.preventDefault());

        this.map.on('singleclick', (event) => {
            if ( mode != 'add' ){ // event for add TODO: draw interaction//
                console.log('no action on map');
                return;
            }

            var coordinate = toLonLat(event.coordinate);
            var data = this.map.forEachFeatureAtPixel(
                event.pixel,
                function(feature, layer)
                {
                    return [feature, layer];
                },
                {
                    hitTolerance: 15,
                });


            var feature_onHover = null;
            if (data) {
                feature_onHover = data[0];
                console.log(data[1]);
            }

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

            if (feature_onHover){
                if (streetElementNode.isInstance(
                    feature_onHover.parent)
                   ){ // if element is a node
                    // Link a node with other by ID
                    if (this.getLastSelectedNode()){
                        this.linkNodesByID(
                            feature_onHover.parent.getID(),
                            this.getLastSelectedNode().getID()
                        );
                    }
                    this.selectNodeByID(
                        feature_onHover.parent.getID()
                    );

                }
            } else {
                console.log("Add node "+this.selected_node_type);
                this.addNode({
                    'coordinate': coordinate,
                    'type': this.selected_node_type
                });
                // update popup position on map
                if ( this.map.getOverlayById('popup_node_info').getPosition() ) {
                    this.map.getOverlayById('popup_node_info').setPosition(
                        this.getLastSelectedNode().getCoordinates());
                }
            }

        });

        ///////////////////////////////////////////////// END Map section /////////////////////////

        this.shapes    = {array: []};
        this.agencies  = {array: []};
        this.services  = {array: []};
        this.routes    = {array: []};
        this.trips     = {array: []};
        this.stopTimes = {array: []};

        // pointer on map coordinate
        this.pointer = {coordinate: ['0.0000','0.0000']};

        ////// END Public data //////

        this.setMode('select'); // default mode

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
        if (this.getLastSelectedNode() &&
            this.getLastSelectedNode().getID() == node_id)
            return;

        this.historyPush(["selectNodeByID", node_id]);
        this.selectNode(this.nodes[node_id]);
    }

    focusNodeOnMapByID (node_id) {
        this.map.getView().setCenter(this.nodes[node_id].getCoordinates());
        this.map.getView().setZoom(17.9); // Parameters from configuration // TODO
        this.pointer.coordinate =
            toLonLat(this.nodes[node_id].getCoordinates()).map(coor => coor.toPrecision(8));
    }

    setNodeCoordinatesByID (node_id, coordinates){ // External
        if (this.nodes[node_id].getLonLat() == coordinates){
            console.log('no change');
            return;
        }

        this.historyPush([
            "setNodeCoordinatesByID",
            node_id,
            coordinates
        ]);
        this.nodes[node_id].setCoordinates(coordinates);
    }

    // Return the streetElementNode last object got in Array
    get getLastElement (){
        if (this.nodes.filter(node => node.isValid()).length) {
            return this.nodes.filter(node => node.isValid()).reverse()[0];
        }
        return null;
    }

    flushStops() {
        console.warn("Nodes keep in memory, to many flushStops are not recommended");
        this.nodes.filter(node => node.getType() == streetElementNode.type.STOP ).forEach(
            node => {
                this.deleteNodeByID(node.getID());
            }
        );
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

