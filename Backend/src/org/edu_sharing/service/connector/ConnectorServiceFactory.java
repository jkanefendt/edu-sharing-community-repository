package org.edu_sharing.service.connector;

import org.alfresco.repo.cache.SimpleCache;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.repository.server.MCAlfrescoAPIClient;
import org.edu_sharing.service.config.model.Config;
import org.edu_sharing.service.toolpermission.ToolPermissionService;
import org.edu_sharing.service.toolpermission.ToolPermissionServiceFactory;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class ConnectorServiceFactory {

	private static String CACHE_KEY = "CONNECTOR_CONFIG";

	private static SimpleCache<String, Serializable> configCache = (SimpleCache<String, Serializable>) AlfAppContextGate.getApplicationContext().getBean("eduSharingConfigCache");
	//static ConnectorService cs = new ConnectorService();
	
	public static ConnectorService getConnectorService(){
		return (ConnectorService)configCache.get(CACHE_KEY);
	}
	public static void invalidate(){
		configCache.remove(CACHE_KEY);
		configCache.put(CACHE_KEY,new ConnectorService());
	}

	public static ConnectorList getConnectorList(){
		return getConnectorList(ToolPermissionServiceFactory.getInstance());
	}
	public static ConnectorList getConnectorList(ToolPermissionService toolPermissionService){

		try{
			if(new MCAlfrescoAPIClient().isAdmin()){
				return getConnectorService().connectorList;
			}
		}catch(Exception e){

		}

		ConnectorList filteredList = new ConnectorList();

		List<Connector> filteredConnectors = new ArrayList<Connector>();
		for(Connector connector : getConnectorService().connectorList.getConnectors()){
			if(toolPermissionService.hasToolPermissionForConnector(connector.getId())){
				filteredConnectors.add(connector);
			}
		}
		filteredList.setConnectors(filteredConnectors);
		return filteredList;
	}
}
