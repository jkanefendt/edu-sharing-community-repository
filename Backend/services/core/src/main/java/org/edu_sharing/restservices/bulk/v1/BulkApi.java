package org.edu_sharing.restservices.bulk.v1;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.alfresco.service.cmr.repository.NodeRef;
import org.apache.log4j.Logger;
import org.edu_sharing.restservices.*;
import org.edu_sharing.restservices.node.v1.model.NodeEntry;
import org.edu_sharing.restservices.shared.ErrorResponse;
import org.edu_sharing.restservices.shared.Filter;
import org.edu_sharing.service.bulk.BulkServiceFactory;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;

@Path("/bulk/v1")
@Tag(name= "BULK v1" )
@ApiService(value = "BULK", major = 1, minor = 1)
@Consumes({ "application/json" })
@Produces({"application/json"})
public class BulkApi {
	private static Logger logger = Logger.getLogger(BulkApi.class);

	@PUT
	@Path("/sync/{group}")

	@Operation(summary = "Create or update a given node", description = "Depending on the given \"match\" properties either a new node will be created or the existing one will be updated")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = NodeEntry.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response sync(@Context HttpServletRequest req,
		   @Parameter(description = "The group to which this node belongs to. Used for internal structuring. Please use simple names only", required = true) @PathParam("group") String group,
		   @Parameter(description = "The properties that must match to identify if this node exists. Multiple properties will be and combined and compared", required = true) @QueryParam("match") List<String> match,
		   @Parameter(description = "The properties on which the imported nodes should be grouped (for each value, a folder with the corresponding data is created)", required = false) @QueryParam("groupBy") List<String> groupBy,
		   @Parameter(description = "type of node. If the node already exists, this will not change the type afterwards",required=true ) @QueryParam("type") String type,
		   @Parameter(description = "aspects of node" ) @QueryParam("aspects") List<String> aspects,
		   @Parameter(description = "properties, they'll not get filtered via mds, so be careful what you add here" , required=true) HashMap<String, String[]> properties,
		   @Parameter(description = "reset all versions (like a complete reimport), all data inside edu-sharing will be lost" , required=false) @QueryParam("resetVersion") Boolean resetVersion

	) {
		try {
			NodeDao nodeDao = NodeDao.getNode(RepositoryDao.getHomeRepository(),
					BulkServiceFactory.getInstance().sync(group, match, groupBy, type, aspects, properties, resetVersion==null ? false : resetVersion).getId(),
					Filter.createShowAllFilter());
			NodeEntry entry = new NodeEntry();
			entry.setNode(nodeDao.asNode());
			return Response.ok().entity(entry).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}


	@POST
	@Path("/find")

	@Operation(summary = "gets a given node", description = "Get a given node based on the posted, multiple criteria. Make sure that they'll provide an unique result")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = NodeEntry.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response find(@Context HttpServletRequest req,
						 @Parameter(description = "properties that must match (with \"AND\" concatenated)" , required=true ) HashMap<String, String[]> properties
	) {
		try {
			NodeRef node = BulkServiceFactory.getInstance().find(properties);
			if(node==null) {
				throw new DAOMissingException(new Throwable("No node matched the criteria"));
			}
			NodeDao nodeDao = NodeDao.getNode(RepositoryDao.getHomeRepository(), node.getId(), Filter.createShowAllFilter());
			NodeEntry entry = new NodeEntry();
			entry.setNode(nodeDao.asNode());
			return Response.ok().entity(entry).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t, ErrorResponse.ErrorResponseLogging.relaxed);
		}
	}
}
