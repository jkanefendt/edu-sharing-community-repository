package org.edu_sharing.service.model;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public interface NodeRef {

    String getOwner();

	void setOwner(String owner);

	interface Preview{
		String getMimetype();
		byte[] getData();
	}
	
	public String getRepositoryId();
	
	public void setRepositoryId(String repositoryId);
	
	public String getStoreProtocol();
	
	public void setStoreProtocol(String storeProtocol);
	
	public String getStoreId();
	
	public void setStoreId(String storeId);
	
	public String getNodeId();
	
	public void setNodeId(String nodeId);
	
	public HashMap<String,Object> getProperties();
	
	public void setProperties(HashMap<String,Object> properties);

	public void setPreview(Preview preview);

	public Preview getPreview();

	public Map<String,Boolean> getPermissions();

	public void setPermissions(Map<String,Boolean> permissions);

	void setAspects(List<String> aspects);

	public List<String> getAspects();

	public void setUsedInCollections(List<NodeRef> usedInCollections);

	public List<NodeRef> getUsedInCollections();

}
