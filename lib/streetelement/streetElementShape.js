import streetElementNode from "./streetElementNode.js";

import Feature from "ol/Feature.js";
import LineString from "ol/geom/LineString.js";

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

export default class streetElementShape {
  constructor(params) {
    // Verify data
    // params.id
    // params.begin
    // params.end
    // params.waypoints
    // params.node_index
    // params.router

    if (isNaN(params.id)) {
    } // TODO
    if (isNaN(params.begin)) {
    } // TODO
    if (isNaN(params.end)) {
    } // TODO

    // Private data

    var nodes_in_shape = []; // TODO deprecate

    var begin_vector = [];
    var waypoint_vectors = []; // Matrix
    var end_vector = [];

    const forward = new LineString([]);

    const feature_shape = new Feature({
      geometry: forward,
      name: "Shape_" + params.id,
    });

    //////////// Privileged //////////////
    this.setBegin = (node_id) => {
      if (node_id != undefined && !isNaN(node_id)) params.begin = node_id;
      else throw Error("Param to set as begin is not a node ID");

      if (params.end) {
      } // TODO

      // Computes route when node has only one link
      if (params.node_index(node_id).getConnections().length == 1) {
        begin_vector = this.constructor.routeSegment(
          params.node_index(node_id), // Node
          params.node_index(node_id).getConnections()[0] // Link
        );
      } else begin_vector = [params.node_index(node_id)]; // Only one node

      // Compute waypoints

      return params.node_index(node_id);
    };

    this.setEnd = (node_id) => {
      if (node_id != undefined && !isNaN(node_id)) params.end = node_id;
      else throw Error("Param to set as end is not a node ID");

      if (params.begin) {
      } // TODO

      if (params.node_index(node_id).getConnections().length == 1) {
        end_vector = this.constructor
          .routeSegment(
            params.node_index(node_id), // Node
            params.node_index(node_id).getConnections()[0] // Link
          )
          .reverse(); // reverse because it's the end
      } else end_vector = [params.node_index(node_id)]; // Only one node

      // Compute waypoints

      return params.node_index(node_id);
    };

    this.getBegin = () => {
      return params.begin;
    };

    this.getEnd = () => {
      return params.end;
    };

    this.setVisible = (bool_visible) => {
      if (bool_visible)
        if (!params.layer.getSource().getFeatureById(feature_shape.ol_uid))
          params.layer.getSource().addFeature(feature_shape);
        else if (params.layer.getSource().getFeatureById(feature_shape.ol_uid))
          params.layer.getSource().removeFeature(feature_shape);
    };

    this.getSegmentsInShape = () => {
      var nodes = new Array(0);

      if (begin_vector.length) nodes.push(begin_vector);
      else throw Error("No begin defined in shape " + params.id);
      // waypoints

      if (end_vector.length) nodes.push(end_vector);
      else throw Error("No end defined in shape " + params.id);

      return nodes;
    };

    this.getCoordinates = () => {
      return this.getSegmentsInShape()
        .flat()
        .map((node) => node.getCoordinates()); // TODO
    };

    this.updateInMap = () => {
      forward.setCoordinates(
        this.getSegmentsInShape()
          .flat()
          .map((node) => node.getCoordinates()) // TODO get Points instead nodes
      );
    };

    this.getID = () => params.id; // TODO

    this.getInfo = () => {
      return {
        id: params.id,
        points: [], // TODO
      };
    };

    this.isValid = () => true; // TODO

    ///////////// END VARIABLE DEF /////////////
    // Setup the shape

    // Set the begin and end
    if (params.begin != undefined && !isNaN(params.begin))
      this.setBegin(params.begin);
    if (params.end != undefined && !isNaN(params.end)) this.setEnd(params.end);

    // forward.setCoordinates(
    //     this.getSegmentsInShape().flat().map(node => node.getCoordinates()).flat()
    // );

    // Set the end point

    console.log(params.layer);
  }

  static isInstance(obj) {
    if (typeof obj == "object") {
      if (obj.constructor.name == streetElementShape.name) {
        return true;
      }
    }
    console.log(
      "The variable is not a " + streetElementShape.name + " instance"
    );
    return false;
  }

  static routeSegment(node, link) {
    // return a shape segment
    var result = [node];
    var nextNode = link.getPartner(node);

    if (nextNode) {
      // Node in the link
    } else {
      // Node not found
      return null;
    }

    if (nextNode.isValid()) {
      if (nextNode.getConnections().length > 2) {
        // It is a fork
        result.push(nextNode); // to return the fork and end execution
      } else if (
        (nextNode.getConnections().length == 1) |
        (nextNode.getType() == streetElementNode.type.ENDPOINT)
      ) {
        // Endpoint
        result.push(nextNode); // to return the endpoint and end execution
      } else {
        // return the nodes until fork/endpoint
        nextNode.getConnections().forEach((inner_link) => {
          if (inner_link != link) {
            // it is not the same link
            result = result.concat(
              // TODO, eval null return
              streetElementShape.routeSegment(nextNode, inner_link)
            );
          }
        });
      }
      return result;
    } else {
      return null;
    }
  }
}
