import streetElementLink from "./streetElementLink.js";
import streetElementNode from "./streetElementNode.js";
import streetElementAgency from "./streetElementAgency.js";
import streetElementRoute from "./streetElementRoute.js";
import streetElementShape from "./streetElementShape.js";
import streetElementCalendar from "./streetElementCalendar.js";
import streetElementTrip from "./streetElementTrip.js";
import streetElementStopTime from "./streetElementStopTime.js";
import streetElementRoutingMachine from "./streetElementRoutingMachine.js";

// Import all dependencies we need from OpenLayers
import Map from "ol/Map.js";
import View from "ol/View.js";
import OSM from "ol/source/OSM.js";
import Tile from "ol/layer/Tile.js";
import {
  Control,
  Attribution,
  FullScreen,
  ScaleLine,
  defaults as defaultsControl,
} from "ol/control.js";
import {
  Select,
  Translate,
  defaults as defaultsInteractions,
} from "ol/interaction.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import Style from "ol/style/Style.js";
import Fill from "ol/style/Fill.js";
import Circle from "ol/style/Circle.js";
import Stroke from "ol/style/Stroke.js";
import Icon from "ol/style/Icon.js";
import Vector from "ol/layer/Vector.js";
import SourceVector from "ol/source/Vector.js";
import Point from "ol/geom/Point.js";
import LineString from "ol/geom/LineString.js";

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
  constructor(params) {
    if (
      params.center &&
      params.center instanceof Array &&
      params.center.length == 2
    ) {
      params.center = fromLonLat(params.center);
    } else params.center = [0.0, 0.0];

    if (
      params.lonLatExtent &&
      params.lonLatExtent instanceof Array &&
      params.center.length == 2
    ) {
      params.lonLatExtent = params.lonLatExtent
        .map((coor) => fromLonLat(coor))
        .flat();
    } else params.lonLatExtent = undefined;

    if (
      // TODO check routing machine url
      params.routing_machine_url &&
      params.routing_machine_url.length
    ) {
      // There is custom url
    } else params.routing_machine_url = undefined;

    ////// Private data ///////////////////////////////////////
    /////////////// map //////////////// Network map //////////
    var history = []; // GTFS state            //
    var map;
    var layers = {}; // Network layers        //
    var nodes = []; //
    var mode = "select"; // Mode sEG it's working //
    var links_router = new streetElementRoutingMachine({
      routing_machine_url: params.routing_machine_url,
    });
    var shapes_router = new streetElementRoutingMachine({
      routing_machine_url: params.routing_machine_url,
      lonLat: false,
      object: true,
      distance: true,
    }); // NOTE Could be random router service

    var onAddNode; // function executes every time a node is added
    var onDeleteNode; // function executes every time a node is deleted
    var onSelectNode; // function executes every time a node is selected
    ///////////////////////////////////////////////////////////

    ////// Private methods //////
    var addLink = (nodeA, nodeB) => {
      // Internal
      // Creates a link connnection between two nodes
      if (nodeA.getID() == nodeB.getID()) {
        return 1;
      } // Error

      var nodea_links_nodeb = false;
      var nodeb_links_nodea = false;

      if (
        nodeA
          .getConnections()
          .map((conn) => conn.getPartner(nodeA))
          .some((node) => node.getID() == nodeB.getID())
      ) {
        // NodeA is linked to NodeB
        nodea_links_nodeb = true;
      }

      if (
        nodeB
          .getConnections()
          .map((conn) => conn.getPartner(nodeB))
          .some((node) => node.getID() == nodeA.getID())
      ) {
        // NodeB is linked to NodeA
        nodeb_links_nodea = true;
      }

      if (nodeb_links_nodea && nodea_links_nodeb) {
        // Already linked
        return 0;
      } else if (nodeb_links_nodea || nodea_links_nodeb) {
        throw new Error("Half link " + [nodeA.getID(), nodeB.getID()].join());
      } // Error

      try {
        if (nodeA.isValid() && nodeB.isValid()) {
        } //OK
        else {
          throw new Error(
            "non valid nodes " + [nodeA.getID(), nodeB.getID()].join()
          );
        }
      } catch (err) {
        console.error(err);
      }

      const connection = new streetElementLink({
        id: this.links.length, // ID number
        nodeA: nodeA, // First node
        nodeB: nodeB, // Second node
        router: links_router,
        layer: layers[streetElementLink.type.LINK], // always link layer
        direction_layer: layers[streetElementLink.type.DIRECTION], // direction layer
      });
      this.links.push(
        connection // add this link to the group
      );
      // Update link on nodes
      nodes[nodeA.getID()].addConnection(connection);
      nodes[nodeB.getID()].addConnection(connection);

      this.updateElementLayerByID(nodeA.getID());
      this.updateElementLayerByID(nodeB.getID());
      return connection.getID();
    }; // END addlink

    var addLayer = (type, radius, color) => {
      // Add layers to map at the initialization
      var style;

      switch (type) {
        case "select": // Terminals, green
          style = new Style({
            image: new Circle({
              radius: radius,
              fill: new Fill({ color: color }),
            }),
          });
          break;
        case streetElementLink.type.LINK:
          style = new Style({
            stroke: new Stroke({
              color: color,
              width: 4.5,
            }),
          });
          break;
        case "shape":
          style = new Style({
            stroke: new Stroke({
              color: color,
              width: 4.5,
            }),
          });
          break;
        case streetElementLink.type.DIRECTION:
          style = function (feature) {
            var geometry = feature.getGeometry();
            var style = [];
            geometry.forEachSegment(function (start, end) {
              var dx = end[0] - start[0];
              var dy = end[1] - start[1];
              var rotation = Math.atan2(dy, dx);
              style.push(
                new Style({
                  geometry: new Point(start),
                  image: new Icon({
                    // src: 'assets/img/arrow.png',
                    src: "arrow.png",
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
          // Default style
          style = new Style({
            image: new Circle({
              radius: radius,
              fill: new Fill({ color: color }),
            }),
          });
          break;
      }

      const vectorLayer = new Vector({
        source: new SourceVector(),
        style: style,
      });
      vectorLayer.name = type; // Name the layer
      layers[type] = vectorLayer; // Add layer to obj
    }; // END addLayer

    ////// Privileged methods //////
    this.getMode = () => {
      return mode;
    };

    this.setMode = (new_mode = "select") => {
      mode = new_mode;
      switch (mode) {
        case "add":
          map_select_nodes.setActive(false);
          map_select_links.setActive(false);
          break;

        case "select":
        case "remove":
          map_select_nodes.setActive(true);
          map_select_links.setActive(false);
          break;

        case "split":
        case "cut":
          map_select_nodes.setActive(false);
          map_select_links.setActive(true);
          break;

        default:
          // Activates map select nodes
          mode = "select";
          map_select_nodes.setActive(true);
          map_select_links.setActive(false);
      }
    };

    this.historyArray = () => {
      return history.slice();
    };

    this.historyPush = (command) => {
      // TODO private method
      // command is a list with an external function and its arguments

      var input_command_name = command[0];
      var last_command_name;
      var last_last_command_name;

      if (history.length) {
        last_command_name = history[history.length - 1][0];
      } else if (history.length > 1) {
        last_last_command_name = history[history.length - 2][0];
      }

      switch (input_command_name) {
        case "selectNodeByID":
        case "unselectNode":
          switch (last_command_name) {
            case "selectNodeByID":
            case "unselectNode":
              history.pop();
              break;
            case "updateShapeByID":
              if (
                (last_last_command_name === "unselectNode") |
                (last_last_command_name === "selectNodeByID")
              ) {
                // keep only the actual node selected
                var temporal = history.pop();
                history.pop();
                history.push(temporal);
              }
              break;
          }

          history.push(command);
          break;
        case "setNodeCoordinatesByID":
          if (
            (history[history.length - 1][0] == "setNodeCoordinatesByID") &
            (history[history.length - 1][1] == command[1])
          ) {
            // only save the last move for same node
            history.pop();
          }

          history.push(command);
          break;
        case "updateShapeByID":
          if (history[history.length - 1][1] == command[1]) {
            // save the last update for the same shape
            history.pop();
          }

          history.push(command);
          break;
        default:
          history.push(command);
          break;
      }
    };

    this.historyLoad = (in_history) => {
      // Loads the history inputs user did to get the actual state
      // every time it loads, remakes all the history
      // TODO if method is not in class, error code
      try {
        in_history.forEach((commad) => {
          try {
            this[commad[0]](...commad.slice(1, commad.length));
          } catch (err) {
            throw err + " on command load: " + JSON.stringify(commad, null, 4);
          }
        });
      } catch (err) {
        console.error("Load failed: " + err);
      }
    };

    this.historyString = () => {
      // Saves history as an Stringed array
      var result = JSON.stringify(history).replace(/\]\,\[/g, "],\n\t\t\t[");
      result = result.replace(/\[\[/, "[\n\t\t\t[");
      result = "const _streetElementGroupHistory = " + result;
      result = result.replace(/\]$/, "\n];\n");
      return result;
    };

    this.getNodeByID = (node_id) => {
      // TODO
      return nodes[node_id]; // TODO TEMP
    };

    this.addNode = (params) => {
      // Add a node to the group
      // params.coordinate: a single of coordinate, point
      // params.type: the element layer name

      if (typeof params != "object") {
        return false;
      }

      if (params.coordinate && params.type) {
        // Nothing to do
      } else {
        // Parameters are less than required
        return false;
      }

      if (params.nolink == true) {
        // it makes the node independent and doesn't
        // create a link with the node behind
        this.selectNode(null); // internal doesn't history
      }

      if (
        (params.type == streetElementNode.type.ENDPOINT) |
        (params.type == streetElementNode.type.STOP) |
        (params.type == streetElementNode.type.WAYPOINT) |
        (params.type == streetElementNode.type.FORK)
      ) {
        // good type, continue
      } else {
        throw Error("Bad node type on init");
        return 1; // error
      }

      if (
        params.type == streetElementNode.type.STOP &&
        params.stop_id == undefined
      ) {
        params.stop_id =
          "No ID for this stop, " + String(params.coordinate) + " LonLat";
      }

      if (
        // Verify if there is another node with the same stop id
        params.type == streetElementNode.type.STOP &&
        nodes.some((node) => node.getStopInfo().stop_id == params.stop_id)
      ) {
        return false;
      } // If there is not we add the new node

      var new_node = new streetElementNode(
        params.coordinate, // coordinate
        layers[params.type] // layer
      );

      this.historyPush(["addNode", params]);

      // If node has stop type, add stop info
      if (
        (params.type == streetElementNode.type.STOP) |
        (params.type == streetElementNode.type.ENDPOINT)
      ) {
        // Add the rest of the params as node_info
        new_node.setStopInfo(params);
      }

      nodes.push(new_node);

      if (this.getLastSelectedNode()) {
        // Connect nodes
        try {
          addLink(this.getLastSelectedNode(), new_node);
        } catch (err) {
          throw new Error(
            "add link: " +
              this.getLastSelectedNode().getID() +
              " : " +
              new_node +
              "\n" +
              err.message
          );
        }
      }

      // The new element is the LastSelectNode now
      // keeps only the new element
      if (nodes.filter((node) => node.isValid()).length) {
        this.selectNode(nodes.filter((node) => node.isValid()).reverse()[0]);
      } else {
        this.selectNode(null);
      }

      if (onAddNode && typeof onAddNode === "function") onAddNode();

      return 0; // done
    };

    this.onAddNode = (onfunc) => {
      onAddNode = onfunc;
    };

    this.onDeleteNode = (onfunc) => {
      onDeleteNode = onfunc;
    };

    this.onSelectNode = (onfunc) => {
      onSelectNode = onfunc;
    };

    this.addShape = (params) => {
      // {
      //     id: shape_id,
      //     start: null,
      //     end: null,
      // }
      if (this.shapes.array.some((shape) => shape.getID() === params.id)) {
        console.error("Shape with the ID " + params.id + " already in SEG");
        return 1;
      }

      if (params.waypoints instanceof Array) {
      } else params.waypoints = [];

      // "Clone" the params, to keep router and layer out the history
      this.historyPush(["addShape", Object.assign({}, params)]);

      params.node_index = this.getNodeByID;
      params.router = shapes_router;
      params.layer = layers["shape"];

      this.shapes.array.push(new streetElementShape(params));
      return 0;
    };

    this.removeShape = (shape_id) => {
      this.historyPush(["removeShape", shape_id]);
      // This removes the shape from the array
      this.shapes.array = this.shapes.array.filter(
        (shape) => shape.getID() != shape_id
      );
    };

    this.updateShapeByID = (shape_id, params) => {
      // Save in log
      this.historyPush([
        "updateShapeByID",
        shape_id,
        Object.assign({}, params),
      ]);

      this.shapes.array
        .filter((shape) => shape.getID() === shape_id)[0]
        .updateShape(params);
    };

    this.addScheme = (service_id, trip_id) => {
      this.historyPush(["addScheme", service_id, trip_id]);
      this.services.array
        .filter((service) => service.getID() == service_id)[0]
        .addTrip(trip_id);
    };

    this.removeScheme = (service_id, trip_id) => {
      this.historyPush(["removeScheme", service_id, trip_id]);
      this.services.array
        .filter((service) => service.getID() == service_id)[0]
        .removeTrip(trip_id);
    };

    this.linkNodesByID = (nodeA_id, nodeB_id) => {
      // External
      this.historyPush(["linkNodesByID", nodeA_id, nodeB_id]);
      addLink(nodes[nodeA_id], nodes[nodeB_id]);
    };

    this.splitLinkByID = (link_id, coordinate, type) => {
      this.historyPush(["splitLinkByID", link_id, coordinate, type]);
      // invalidate the link
      this.links[link_id].terminate();

      // TODO projection on the link to get a coordinate
      // TODO type node

      // add a Shape Node
      var new_node = new streetElementNode(
        coordinate, // coordinate
        layers[streetElementNode.type.WAYPOINT] // layer
      );

      nodes.push(new_node);

      // The new element is the LastSelect now
      this.selectNode(new_node);

      // Link with the previous node A
      addLink(new_node, this.links[link_id].getNodes()[0]);

      // Link with the previous node B
      addLink(new_node, this.links[link_id].getNodes()[1]);
    };

    this.changeNodeInfoByID = (node_id, info) => {
      // TODO improve
      this.historyPush(["changeNodeInfoByID", node_id, info]);
      // { // input param: info::
      //     type: layer,
      //     stop_id: number,
      //     stop_name: text,
      //     stop_desc: text,
      // }

      if (info.type) {
        nodes[node_id].setLayer(layers[info.type]);
      }

      // verify the data
      var stop_info = {};

      if (info.stop_id && info.stop_name && info.stop_desc && info.stop_url) {
        // TODO check
      }

      nodes[node_id].setStopInfo(info);

      if (this.getLastSelectedNode().getID() == node_id) {
        // If is selected node then update popup info
        this.updatePopup();
      }
    };

    this.deleteNodeByID = (value) => {
      // This one is easy because last in Array but
      // a point in middlen needs more logic
      var element = nodes[value];
      if (!element.isValid()) {
        console.warn("Invalid element " + element.getID());
        return;
      }
      this.historyPush(["deleteNodeByID", value]);

      var deletedNodePartners = element
        .getConnections()
        .map((conn) => conn.getPartner(element));

      element.terminate(); // terminate element

      if (deletedNodePartners.length == 2)
        addLink(deletedNodePartners[0], deletedNodePartners[1]);

      // unselectNode
      this.selectNode(null);

      if (onDeleteNode && typeof onDeleteNode === "function") onDeleteNode();
    };

    this.updateElementLayerByID = (element_id) => {
      // TODO
      if (nodes[element_id].getConnections().length > 2) {
        // Intersection
        nodes[element_id].setLayer(layers["fork"]);
      }
    };

    this.getFeatureByUID = (ol_uid) => {
      var result = [];
      Object.entries(layers).forEach(([key, value]) => {
        if (value.getSource().getFeatureByUid(ol_uid)) {
          result.push(value.getSource().getFeatureByUid(ol_uid));
        }
      });
      return result.length ? result[0] : null;
    };

    this.updatePopup = () => {
      if (this.getLastSelectedNode() != null) {
        // update popup info
        this.popup_content.id = this.getLastSelectedNode().getID();
        this.popup_content.type = this.getLastSelectedNode().getType();
        this.popup_content.connections =
          this.getLastSelectedNode().getConnections().length;
        this.popup_content.stop_info = this.getLastSelectedNode().getStopInfo();
      }
    };

    this.selectNode = (element) => {
      this.updatePopup();
      if (this.getLastSelectedNode()) {
        // needed for nodes who become forks
        if (element) this.updateElementLayerByID(element.getID());
      }
      map_select_nodes.getFeatures().clear(); // deselect extra picks

      if (element) {
        map_select_nodes
          .getFeatures()
          .push(this.getFeatureByUID(element.getFeatureUID()));

        // send the node as a paramenter for onSelectNode function
        if (onSelectNode && typeof onSelectNode === "function")
          onSelectNode(element);
      }
    };

    this.getLastSelectedNode = () => {
      if (map_select_nodes.getFeatures().getArray().length) {
        return map_select_nodes.getFeatures().getArray().reverse()[0].parent;
      }
      return null;
    };

    this.disableElementsByType = (type) => {
      if (
        (type == streetElementNode.type.ENDPOINT) |
        (type == streetElementNode.type.STOP) |
        (type == streetElementNode.type.WAYPOINT) |
        (type == streetElementNode.type.FORK) |
        (type == streetElementLink.type.LINK) |
        (type == streetElementLink.type.DIRECTION)
      ) {
        layers[type].setVisible(false);
      } else {
        console.error("Error: layer " + type + " not found");
      }
    };

    this.enableElementsByType = (type) => {
      if (
        (type == streetElementNode.type.ENDPOINT) |
        (type == streetElementNode.type.STOP) |
        (type == streetElementNode.type.WAYPOINT) |
        (type == streetElementNode.type.FORK) |
        (type == streetElementLink.type.LINK) |
        (type == streetElementLink.type.DIRECTION)
      ) {
        layers[type].setVisible(true);
      } else {
        console.error("Error: layer " + type + " not found");
      }
    };

    this.stopsToGTFS = () => {
      var stops_CSV_cols =
        "stop_id,stop_code,stop_name,stop_desc,stop_lat,\
stop_lon,zone_id,stop_url,location_type,\
parent_station,stop_timezone,wheelchair_boarding".split(
          ","
        );
      var result =
        new String(
          nodes
            .filter((node) => node.isValid())
            .filter(
              (node) =>
                node.getType() == streetElementNode.type.STOP ||
                node.getType() == streetElementNode.type.ENDPOINT
            )
            .map(
              (
                node // new list with all nodes
              ) =>
                stops_CSV_cols
                  .map((stop_col) =>
                    node.getStopInfo()[stop_col]
                      ? node.getStopInfo()[stop_col]
                      : ""
                  )
                  .join()
            )
            .join("\n")
        ) + "\n";
      // Return the table as string
      return [stops_CSV_cols.join(), result].join("\n"); // return a string object with GTFS table in
    };

    this.shapesToGTFS = () => {
      var shape_CSV =
        "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled\n";
      this.shapes.array.forEach((shape) => {
        var shape_info = shape.getInfo();
        shape_info["points"].forEach((l_coor, key) => {
          shape_CSV +=
            String(shape.getID()) +
            "," +
            String(l_coor[1]) +
            "," +
            String(l_coor[0]) +
            "," +
            key +
            "," +
            shape_info["distances"][key] +
            "\n";
        });
      });
      // Return the table as string
      return shape_CSV; // return a string object with GTFS table in
    };

    this.toJSON = () => {
      // Create a static data JSON with the whole info needed
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
        result.routes.push(route.getInfo());
      });

      result.services = [];
      this.services.array.forEach((service) => {
        result.services.push(service.getInfo());
      });

      result.trips = [];
      this.trips.array.forEach((trip) => {
        result.trips.push(trip.getInfo());
      });

      result.stopTimes = [];
      this.stopTimes.array.forEach((stoptime) => {
        result.stopTimes.push(stoptime.getInfo());
      });

      result.shapes = [];
      this.shapes.array.forEach((shape) => {
        result.shapes.push(shape.getInfo());
      });

      // Stops info // TODO

      return result;
    };

    (this.selectNodeByID = (node_id) => {
      // External // TODO verify data
      if (
        this.getLastSelectedNode() &&
        this.getLastSelectedNode().getID() == node_id
      )
        return;

      this.historyPush(["selectNodeByID", node_id]);
      this.selectNode(nodes[node_id]);
    }),
      (this.focusNodeOnMapByID = (node_id) => {
        map.getView().setCenter(nodes[node_id].getCoordinates());
        map.getView().setZoom(17.9); // Parameters from configuration // TODO
        this.pointer.coordinate = toLonLat(nodes[node_id].getCoordinates()).map(
          (coor) => coor.toPrecision(8)
        );
      }),
      (this.setNodeCoordinatesByID = (node_id, coordinates, routed = false) => {
        // External
        if (nodes[node_id].getLonLat() == coordinates) {
          // No changes
          return;
        }
        this.historyPush([
          "setNodeCoordinatesByID",
          node_id,
          coordinates,
          routed,
        ]);
        nodes[node_id].setCoordinates({ lonLat: coordinates, routed: routed });
      }),
      (this.flushStops = () => {
        console.warn(
          "Nodes keep in memory, to many flushStops are not recommended"
        );
        nodes
          .filter((node) => node.getType() == streetElementNode.type.STOP)
          .forEach((node) => {
            this.deleteNodeByID(node.getID());
          });
      }),
      (this.getMap = () => {
        // TEMP // FIXME // don't expose the map, use methods instead
        return map;
      }),
      (this.getWaypoints = () => {
        return layers[streetElementNode.type.WAYPOINT]
          .getSource()
          .getFeatures()
          .map((feature) => feature.parent);
      }),
      (this.getStops = () => {
        return layers[streetElementNode.type.STOP]
          .getSource()
          .getFeatures()
          .map((feature) => feature.parent);
      }),
      (this.getEndpoints = () => {
        return layers[streetElementNode.type.ENDPOINT]
          .getSource()
          .getFeatures()
          .map((feature) => feature.parent);
      }),
      (this.getForks = () => {
        return layers[streetElementNode.type.FORK]
          .getSource()
          .getFeatures()
          .map((feature) => feature.parent);
      }),
      ////// END Privileged methods //////

      ////// Public data //////
      (this.selected_node_type = streetElementNode.type.WAYPOINT); // TODO, private

    this.popup_content = {
      id: null,
      type: null,
      connections: null,
      geo_lon: "",
      geo_lat: "",
      stop_info: {},
    };

    this.links = []; // could it to be private? // TODO

    //////////////////////////////////////////////////// Map section /////////////////////////

    // Add layers
    addLayer(streetElementLink.type.LINK, 2, "#585CCB"); // links between nodes
    addLayer(streetElementNode.type.WAYPOINT, 5, "#585CCB");
    addLayer(streetElementNode.type.FORK, 5, "#A46FF5");
    addLayer(streetElementNode.type.STOP, 7, "rgba(232,70,35,0.7)");
    addLayer(streetElementNode.type.ENDPOINT, 5, "green");
    addLayer(streetElementLink.type.DIRECTION, 0, "yellow"); // link direction
    addLayer("select", 3, "yellow");
    addLayer("shape", 5, "#BA4806");

    var map_select_nodes = new Select({
      filter: (feature) => {
        if (feature.parent) return streetElementNode.isInstance(feature.parent);
        else return false;
      },
      hitTolerance: 15,
    });

    map_select_nodes.on("select", (event) => {
      this.updatePopup();

      if (event.deselected.length) {
        // deselect from shape section
        event.deselected.forEach(
          (unselected_feature) =>
            (this.shapes.selected_nodes = this.shapes.selected_nodes.filter(
              (node_id) => node_id != unselected_feature.parent.getID()
            ))
        );

        if (!event.selected.length) {
          map.getOverlayById("popup_node_info").setPosition(undefined);
          // there are deselected && selected == []
          this.historyPush(["unselectNode"]);
          return;
        }
      }
      // there are new selected nodes
      this.shapes.selected_nodes.push(event.selected[0].parent.getID());

      if (mode == "remove") {
        this.deleteNodeByID(event.selected[0].parent.getID());
        return;
      }

      if (mode == "select")
        map
          .getOverlayById("popup_node_info")
          .setPosition(event.selected[0].parent.getCoordinates());

      this.selectNodeByID(event.selected[0].parent.getID());

      if (event.target.getFeatures().getLength() > 1) {
        map.getOverlayById("popup_node_info").setPosition(undefined);
      }
    });

    var map_select_links = new Select({
      layers: [layers[streetElementLink.type.LINK]],
      hitTolerance: 15,
    });
    map_select_links.setActive(false); // inactive by default

    map_select_links.on("select", (event) => {
      if (mode == "cut" && event.selected.length) {
        // Remove a link
        this.deleteLinkByID(event.selected[0].parent.getID());
      } else if (mode == "split" && event.selected.length) {
        // It's a link, then split it
        this.splitLinkByID(
          event.selected[0].parent.getID(),
          toLonLat(event.mapBrowserEvent.coordinate),
          this.selected_node_type
        );
      }
      // clear features always
      event.target.getFeatures().clear();
    });

    var map_translate = new Translate({
      features: map_select_nodes.getFeatures(),
    });

    map_translate.on("translateend", (event) => {
      // TODO update nodes when one node drops over another
      var data = map.forEachFeatureAtPixel(
        event.mapBrowserEvent.pixel,
        function (feature, layer) {
          return [feature, layer];
        },
        {
          hitTolerance: 15,
        }
      );

      // if (data) {
      //   // TODO // FIXME need more information about this section
      //   console.log(data);
      // }

      // Updates popup for application to show it
      this.updatePopup();

      // refresh all nodes position and log changes
      event.features.getArray().forEach((feature) => {
        this.setNodeCoordinatesByID(
          feature.parent.getID(),
          feature.parent.getLonLat(),
          true
        );
      });
    });

    map_translate.on("translating", (event) => {
      event.features.getArray().forEach((feature) => {
        // For every selected keep reseting coordinates
        nodes[feature.parent.getID()].setCoordinates({
          lonLat: feature.parent.getLonLat(),
        });
      });
    });

    map_translate.on("translatestart", (event) => {
      // When translate start hide the popup
      map.getOverlayById("popup_node_info").setPosition(undefined);
    });

    map = new Map({
      // FIXME include in a function
      interactions: defaultsInteractions().extend([
        map_select_nodes,
        map_select_links,
        map_translate,
      ]),
      controls: defaultsControl({ attribution: false }).extend([
        new Attribution({
          collapsible: false,
        }),
        new FullScreen(),
        // {source: 'fullscreen-view'} // TODO should become from outside class
        new ScaleLine(), // SI by default
      ]),
      layers: [
        new Tile({
          source: new OSM(),
        }),
      ].concat(Object.values(layers)),
      keyboardEventTarget: document,
      view: new View({
        center: params.center,
        zoom: 12,
        // [minx,miny,max,may]
        extent: params.lonLatExtent,
      }),
    });

    map
      .getControls()
      .getArray()
      .filter(
        (control) => control.element.className.split(" ")[0] == "ol-attribution"
      )[0].element.innerHTML =
      '<ul><li> \
                <a href="https://github.com/jeancahu/GTFS_shapes_editor_JS" \
                target="_blank">Shape Editor</a> \
                | © <a href="https://www.openstreetmap.org/copyright" \
                target="_blank">OpenStreetMap</a> contributors.</li></ul><button \
                type="button" title="Attributions"><span \
                class="ol-attribution-expand">i</span></button>';

    // Add control to map
    this.addMapControl = (documentElement) => {
      if (documentElement) {
        map.addControl(
          new Control({
            element: documentElement,
          })
        );
      } else {
        console.error("No a documentElement");
      }
    };

    // TODO // create interaction for pointer move
    // map.on(
    //   "pointermove",
    //   (event) =>
    //     (this.pointer.coordinate = toLonLat(event.coordinate).map((coor) =>
    //       coor.toPrecision(8)
    //     ))
    // );

    map.on("dblclick", (event) => event.preventDefault());

    map.on("singleclick", (event) => {
      // update pointer coordinates and add nodes if mode is true
      this.pointer.coordinate = toLonLat(event.coordinate).map((coor) =>
        coor.toPrecision(8)
      );

      if (mode != "add") {
        // SingleClick is for add mode only
        return;
      }

      var coordinate = toLonLat(event.coordinate);
      var data = map.forEachFeatureAtPixel(
        event.pixel,
        function (feature, layer) {
          return [feature, layer];
        },
        {
          hitTolerance: 15,
        }
      );

      var feature_onHover = null;
      if (data) {
        feature_onHover = data[0];
      }

      ////////////////////////// create shape ////////////////

      if (feature_onHover) {
        if (streetElementLink.isInstance(feature_onHover.parent)) {
          // if element is a link
          if (feature_onHover.parent.oneshot) {
            feature_onHover.parent.oneshot(feature_onHover.parent.getID());
            feature_onHover.parent.oneshot = undefined;
            return; // end execution
          }
        }
      }

      /////////////////////  end create shape ////////////////

      if (feature_onHover) {
        if (streetElementNode.isInstance(feature_onHover.parent)) {
          // if element is a node
          // Link a node with other by ID
          if (this.getLastSelectedNode()) {
            this.linkNodesByID(
              feature_onHover.parent.getID(),
              this.getLastSelectedNode().getID()
            );
          }
          this.selectNodeByID(feature_onHover.parent.getID());
        }
      } else {
        // Add a new node
        this.addNode({
          coordinate: coordinate,
          type: this.selected_node_type,
        });
        // update popup position on map
        if (map.getOverlayById("popup_node_info").getPosition()) {
          map
            .getOverlayById("popup_node_info")
            .setPosition(this.getLastSelectedNode().getCoordinates());
        }
      }
    });

    ///////////////////////////////////////////////// END Map section /////////////////////////

    this.shapes = { array: [], selected_nodes: [] };
    this.agencies = { array: [] };
    this.services = { array: [] };
    this.routes = { array: [] };
    this.trips = { array: [] };
    this.stopTimes = { array: [] };

    // pointer on map coordinate
    this.pointer = { coordinate: ["0.0000", "0.0000"] };

    ////// END Public data //////

    this.setMode("select"); // default mode
  } ////// END streetElementGroup constructor //////

  ////// Public methods //////

  static isInstance(obj) {
    if (typeof obj == "object") {
      if (obj.constructor.name == streetElementGroup.name) {
        return true;
      }
    }
    console.error(
      "The variable is not a " + streetElementGroup.name + " instance"
    );
    return false;
  }

  addAgency(
    agency_id,
    agency_name,
    agency_url,
    agency_timezone,
    agency_lang,
    agency_phone,
    agency_fare_url,
    agency_email
  ) {
    var agency = new streetElementAgency(
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
      agency_email,
    ]);

    this.agencies.array.push(agency);

    return true; // TODO
  }

  removeAgency(agency_id) {
    this.historyPush(["removeAgency", agency_id]);

    // This removes the agency from the list
    this.agencies.array = this.agencies.array.filter(
      (agency) => agency.getID() != agency_id
    );
  }

  addService(service_info) {
    // Verify data
    if (typeof service_info.monday == "boolean") {
    } else return 1;

    if (typeof service_info.tuesday == "boolean") {
    } else return 1;

    if (typeof service_info.wednesday == "boolean") {
    } else return 1;

    if (typeof service_info.thursday == "boolean") {
    } else return 1;

    if (typeof service_info.friday == "boolean") {
    } else return 1;

    if (typeof service_info.saturday == "boolean") {
    } else return 1;

    if (typeof service_info.sunday == "boolean") {
    } else return 1;

    this.historyPush(["addService", service_info]);

    this.services.array.push(new streetElementCalendar(service_info));

    return 0;
  }

  removeService(service_id) {
    this.historyPush(["removeService", service_id]);

    // This removes the service from the array
    this.services.array = this.services.array.filter(
      (service) => service.getID() != service_id
    );
  }

  addRoute(route_id, agency_id, route_short_name, route_long_name, route_type) {
    var route = new streetElementRoute(
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
      route_type,
    ]);

    this.routes.array.push(route);

    return true; // TODO
  }

  removeRoute(route_id) {
    this.historyPush(["removeRoute", route_id]);

    // This removes the route from the array
    this.routes.array = this.routes.array.filter(
      (route) => route.getID() != route_id
    );
  }

  addTrip(params) {
    if (typeof params != "object") {
      return false;
    }

    if (
      params.route_id &&
      params.trip_id &&
      params.direction_id &&
      params.shape_id
    ) {
      var trip = new streetElementTrip(
        params.route_id, // Route object
        params.trip_id,
        params.direction_id,
        params.shape_id // Shape object
      );
    } else {
      // Parameters are less than required
      return false;
    }

    this.historyPush(["addTrip", params]);

    this.trips.array.push(trip);

    return true;
  }

  removeTrip(trip_id) {
    this.historyPush(["removeTrip", trip_id]);

    // This removes the trip from the array
    this.trips.array = this.trips.array.filter(
      (trip) => trip.getID() != trip_id
    );
  }

  addStopTime(
    trip_id, // Trip object
    arrival_time,
    departure_time,
    stop_id // Stop object
  ) {
    var stoptime = new streetElementStopTime(
      trip_id, // Trip object
      arrival_time,
      departure_time,
      stop_id // Stop object
    );

    this.historyPush([
      "addStopTime",
      trip_id, // Trip object
      arrival_time,
      departure_time,
      stop_id, // Stop object
    ]);

    this.stopTimes.array.push(stoptime);

    return true; // TODO
  }

  removeStopTime = (trip_id, stop_id) => {
    this.historyPush(["removeStopTime", trip_id, stop_id]);

    // This removes the stoptime from the array
    this.stopTimes.array = this.stopTimes.array.filter(
      (stoptime) =>
        (stoptime.getID() != stop_id) | (stoptime.getInfo().trip_id != trip_id)
    );
  };

  unselectNode() {
    // for user use
    this.historyPush(["unselectNode"]);
    this.selectNode(null);
  }

  deleteLinkByID(link_id) {
    // TODO: move to link.terminate
    this.historyPush(["deleteLinkByID", link_id]);
    this.links[link_id].terminate();
  }
}
