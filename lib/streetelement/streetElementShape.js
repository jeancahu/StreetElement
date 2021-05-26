import streetElementNode from "./streetElementNode.js";

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

    // params.segments // DEPRECATED

    if (isNaN(params.id)) {
    } // TODO
    if (isNaN(params.begin)) {
    } // TODO
    if (isNaN(params.end)) {
    } // TODO

    var nodes_in_shape = []; // TODO deprecate

    var begin_vector = [];
    var waypoint_vectors = []; // Matrix
    var end_vector = [];
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
      } else end_vector = [params.node_index(node_id)]; // Only one node

      // Compute waypoints

      return params.node_index(node_id);
    };

    this.setEnd = (node_id) => {
      if (node_id != undefined && !isNaN(node_id)) params.end = node_id;
      else throw Error("Param to set as end is not a node ID");

      if (params.begin) {
      } // TODO

      if (params.node_index(node_id).getConnections().length == 1) {
        end_vector = this.constructor.routeSegment(
          params.node_index(node_id), // Node
          params.node_index(node_id).getConnections()[0] // Link
        );
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

    this.getNodesInShape = () => {
      var nodes = [];

      if (begin_vector) nodes.concat(begin_vector);
      else throw Error("No begin defined in shape " + params.id);
      // waypoints

      if (end_vector) nodes.concat(end_vector);
      else throw Error("No end defined in shape " + params.id);

      return nodes;
    };

    this.getID = () => params.id; // TODO

    this.getInfo = () => {
      return {
        id: params.id,
        points: [], // TODO
      };
    };

    this.getSequenceText = () => {
      var result = "";
      params.segments.forEach((segment) => {
        result += "n" + segment[0] + "l" + segment[1] + ",";
      });
      return result; // TODO
    };

    this.getSegments = () => params.segments;

    this.isValid = () => true; // TODO

    this.concatSegment = (shape_segment) => {
      if (nodes_in_shape.length == 0) {
        nodes_in_shape = shape_segment;
      } else {
        if (nodes_in_shape[nodes_in_shape.length - 1] == shape_segment[0]) {
          // it's ok
        } else {
          // it's not compatible
        }
      }
    };

    this.getAllowedSegmentsToConcat = () => {
      if (nodes_in_shape.length) {
        var result = [];
        var link_to_exclude = streetElementLink.getLinkBetween(
          nodes_in_shape[nodes_in_shape.length - 1],
          nodes_in_shape[nodes_in_shape.length - 2]
        );
        var allowed_links = streetElementLink.getLinksFromNode(
          nodes_in_shape[nodes_in_shape.length - 1],
          [link_to_exclude]
        );
        allowed_links.forEach((link) => {
          result.push([nodes_in_shape[nodes_in_shape.length - 1], link]);
        });
        return result;
      } else {
        return ["*"];
      }
    };

    ///////////// END VARIABLE DEF /////////////
    // Setup the shape

    // Set the begin and end
    if (params.begin != undefined && !isNaN(params.begin))
      this.setBegin(params.begin);
    if (params.end != undefined && !isNaN(params.end)) this.setEnd(params.end);

    // Set the end point
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
