package org.edu_sharing.alfresco.policy;

import org.alfresco.model.ContentModel;
import org.alfresco.repo.node.NodeServicePolicies.BeforeCreateNodePolicy;
import org.alfresco.repo.node.NodeServicePolicies.BeforeDeleteAssociationPolicy;
import org.alfresco.repo.node.NodeServicePolicies.BeforeDeleteChildAssociationPolicy;
import org.alfresco.repo.node.NodeServicePolicies.BeforeDeleteNodePolicy;
import org.alfresco.repo.node.NodeServicePolicies.BeforeMoveNodePolicy;
import org.alfresco.repo.node.NodeServicePolicies.BeforeRemoveAspectPolicy;
import org.alfresco.repo.node.NodeServicePolicies.BeforeSetNodeTypePolicy;
import org.alfresco.repo.node.NodeServicePolicies.BeforeUpdateNodePolicy;
import org.alfresco.repo.policy.JavaBehaviour;
import org.alfresco.repo.policy.PolicyComponent;
import org.alfresco.repo.security.authentication.AuthenticationUtil;
import org.alfresco.service.cmr.repository.AssociationRef;
import org.alfresco.service.cmr.repository.ChildAssociationRef;
import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.namespace.QName;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;

import java.util.ArrayList;
import java.util.List;

public class GuestCagePolicy implements BeforeCreateNodePolicy, BeforeDeleteAssociationPolicy,
										BeforeDeleteChildAssociationPolicy,BeforeDeleteNodePolicy,BeforeMoveNodePolicy,
										BeforeRemoveAspectPolicy,BeforeSetNodeTypePolicy,BeforeUpdateNodePolicy{
	
	PolicyComponent policyComponent;
	
	public GuestCagePolicy() {
	}
	
	public void init() {
		policyComponent.bindClassBehaviour(BeforeCreateNodePolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeCreateNode"));
		policyComponent.bindClassBehaviour(BeforeDeleteAssociationPolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeDeleteAssociation"));
		policyComponent.bindClassBehaviour(BeforeDeleteChildAssociationPolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeDeleteChildAssociation"));
		policyComponent.bindClassBehaviour(BeforeDeleteNodePolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeDeleteNode"));
		policyComponent.bindClassBehaviour(BeforeMoveNodePolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeMoveNode"));
		policyComponent.bindClassBehaviour(BeforeRemoveAspectPolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeRemoveAspect"));
		policyComponent.bindClassBehaviour(BeforeSetNodeTypePolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeSetNodeType"));
		policyComponent.bindClassBehaviour(BeforeUpdateNodePolicy.QNAME, ContentModel.TYPE_BASE, new JavaBehaviour(this, "beforeUpdateNode"));
	}
	
	
	public static class GuestPermissionDeniedException extends RuntimeException{

		public GuestPermissionDeniedException(String message) {
			super(message);
		}
		/**
		 * 
		 */
		private static final long serialVersionUID = 1L;
		
		
	}
	
	
	private void checkGuest() throws GuestPermissionDeniedException{
		
		//System.out.println("guest fully: "+AuthenticationUtil.getFullyAuthenticatedUser());
		//System.out.println("guest run as: "+AuthenticationUtil.getRunAsUser());
		//String currentUser = eduSharingWebappUser.get();
		//System.out.println("guest current: "+currentUser);
		List<String> usernames = new ArrayList<>();
		usernames.add(ApplicationInfoList.getHomeRepository().getGuest_username());
		usernames.add(CCConstants.PROXY_USER);


		if(AuthenticationUtil.getFullyAuthenticatedUser() != null
				&& usernames.contains(AuthenticationUtil.getFullyAuthenticatedUser())
				&& !AuthenticationUtil.isRunAsUserTheSystemUser()){
			throw new GuestPermissionDeniedException("guest has no permissions to do that");
		}
	}
	
	@Override
	public void beforeCreateNode(NodeRef arg0, QName arg1, QName arg2, QName arg3) {
		checkGuest();
		
	}
	
	
	@Override
	public void beforeDeleteAssociation(AssociationRef arg0) {
		checkGuest();
		
	}
	
	@Override
	public void beforeDeleteChildAssociation(ChildAssociationRef arg0) {
		checkGuest();
		
	}
	
	@Override
	public void beforeDeleteNode(NodeRef arg0) {
		checkGuest();
		
	}
	
	@Override
	public void beforeMoveNode(ChildAssociationRef arg0, NodeRef arg1) {
		checkGuest();
		
	}
	
	@Override
	public void beforeRemoveAspect(NodeRef arg0, QName arg1) {
		checkGuest();
		
	}
	
	@Override
	public void beforeSetNodeType(NodeRef arg0, QName arg1, QName arg2) {
		checkGuest();
		
	}
	
	@Override
	public void beforeUpdateNode(NodeRef arg0) {
		checkGuest();
		
	}
	
	public void setPolicyComponent(PolicyComponent policyComponent) {
		this.policyComponent = policyComponent;
	}
	
	

}
