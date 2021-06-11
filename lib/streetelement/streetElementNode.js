import { fromLonLat, toLonLat } from "ol/proj.js";
import Point from "ol/geom/Point.js";
import Feature from "ol/Feature.js";

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
  // Static data
  // static #nodesCreated = 0; // TODO private not supported yet

  static nodesCreated = 0;
  static getNodesCreated() {
    return streetElementNode.nodesCreated;
  }

  constructor(coordenate, layer) {
    // Private
    var id = streetElementNode.getNodesCreated();
    ////////// update the nodes counter
    streetElementNode.nodesCreated++;
    /////////
    var connections = []; // Links who connect this element to others nodes
    var node_geometry = new Point(fromLonLat([coordenate[0], coordenate[1]]));
    const feature = new Feature({
      // The feature
      geometry: node_geometry,
    });

    // Public elements

    this.stop_info = {}; // TODO : private

    feature.parent = this; // Pass parent reference

    layer.getSource().addFeature(feature); // Gettin visible on map

    /////////////// Privileged methods

    this.getID = () => id;

    this.getCoordinates = () => {
      return node_geometry.getCoordinates();
    };

    this.getLonLat = () => {
      return toLonLat(node_geometry.getCoordinates());
    };

    this.setCoordinates = (params) => {
      this.stop_info["stop_lon"] = parseFloat(params.lonLat[0]);
      this.stop_info["stop_lat"] = parseFloat(params.lonLat[1]);
      node_geometry.setCoordinates(
        fromLonLat([params.lonLat[0], params.lonLat[1]])
      );
      this.getConnections().forEach((conn) =>
        conn.update({ routed: params.routed })
      ); // Update link
    };

    this.setLayer = (new_layer) => {
      layer.getSource().removeFeature(feature);
      new_layer.getSource().addFeature(feature);
      layer = new_layer;
    };

    this.getType = () => {
      // Layer name is the element type
      return layer.name; // TODO: smarter type resolve
    };

    this.isValid = () => {
      if (layer.getSource().getFeatureByUid(feature.ol_uid)) return true;
      else return false;
    };

    this.getFeatureUID = () => {
      return feature.ol_uid;
    };

    this.addConnection = (value) => {
      // value: streetElementLink
      //verify if there are more than X connections
      connections.push(value);
    };

    this.getConnections = () => {
      return connections.filter((conn) => conn.isValid()); // copy
    };

    // TODO push, rotation
    this.removeConnection = (link) => {
      // link: streetElementLink

      connections = connections.filter((conn) => conn.getID() != link.getID());
    };

    // Terminate element
    this.terminate = () => {
      // delete feature // TODO
      // parent has to delete connections first

      // Terminate links:
      connections.slice(0).forEach((value) => {
        value.terminate(); // Terminate link
      });

      // Remove feature from map // set node invalid
      layer.getSource().removeFeature(feature);
    };
  }

  static isInstance(obj) {
    if (typeof obj == "object") {
      if (obj.constructor.name == streetElementNode.name) {
        return true;
      }
    }
    console.log(
      "The variable is not a " + streetElementNode.name + " instance"
    );
    return false;
  }

  static distance(nodeA, nodeB) {
    // TODO distance between two nodes
    console.log("TODO distance between two nodes");
  }

  static get type() {
    return Object.freeze({
      // The only possible node types
      FORK: "fork",
      WAYPOINT: "waypoint",
      ENDPOINT: "endpoint",
      STOP: "stop",
    });
  }

  setStopInfo(stop_info) {
    // @param: map: stop_info, a map with the stop info
    // TODO verify info
    this.stop_info = stop_info;
    if (stop_info["stop_lon"] && stop_info["stop_lat"])
      this.setCoordinates({
        lonLat: [stop_info["stop_lon"], stop_info["stop_lat"]],
      });
    else {
      this.stop_info["stop_lon"] = this.getLonLat()[0];
      this.stop_info["stop_lat"] = this.getLonLat()[1];
    }
  }

  getStopInfo() {
    if (
      (this.getType() == streetElementNode.type.STOP) |
      (this.getType() == streetElementNode.type.ENDPOINT)
    ) {
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
