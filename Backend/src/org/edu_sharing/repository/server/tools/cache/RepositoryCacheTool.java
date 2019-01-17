package org.edu_sharing.repository.server.tools.cache;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.alfresco.model.ContentModel;
import org.alfresco.repo.security.authentication.AuthenticationUtil;
import org.alfresco.repo.security.authentication.AuthenticationUtil.RunAsWork;
import org.alfresco.service.ServiceRegistry;
import org.alfresco.service.cmr.repository.ChildAssociationRef;
import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.cmr.repository.NodeService;
import org.apache.log4j.Logger;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.MCAlfrescoAPIClient;
import org.edu_sharing.repository.server.MCBaseClient;
import org.edu_sharing.repository.server.RepoFactory;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.service.Constants;
import org.springframework.context.ApplicationContext;

public class RepositoryCacheTool {

	Logger logger = Logger.getLogger(RepositoryCacheTool.class);

	ApplicationContext applicationContext = AlfAppContextGate.getApplicationContext();

	ServiceRegistry sr = (ServiceRegistry) applicationContext.getBean(ServiceRegistry.SERVICE_REGISTRY);
	NodeService nodeService = sr.getNodeService();

	/**
	 * creates a new cache object and puts all subobjects of rootfolderId. when it's
	 * finished the new cache object becomes the current cache object
	 * 
	 * usefull when a cache is already filled but must be refreshed
	 * 
	 * @param authenticationInfo
	 * @param rootfolderId
	 * @throws Throwable
	 */
	public void buildNewCache(HashMap authenticationInfo, String rootfolderId) throws Throwable {
		Map<String, Map<String, Object>> newCache = new ConcurrentHashMap<String, Map<String, Object>>();

		MCBaseClient mcBaseClient = RepoFactory.getInstance(ApplicationInfoList.getHomeRepository().getAppId(),
				authenticationInfo);
		if (mcBaseClient instanceof MCAlfrescoAPIClient) {
			MCAlfrescoAPIClient apiClient = (MCAlfrescoAPIClient) mcBaseClient;
			long startMillies = System.currentTimeMillis();
			logger.info("starting getChildrenRecursive");
			HashMap<String, HashMap<String, Object>> childRecursive = apiClient.getChildrenRecursive(
					MCAlfrescoAPIClient.storeRef, rootfolderId, CCConstants.CCM_TYPE_IO, null, false);
			logger.info("getChildrenRecursive returned.starting to copy to cachemap. size:" + childRecursive.size());
			for (Map.Entry<String, HashMap<String, Object>> entry : childRecursive.entrySet()) {
				newCache.put(entry.getKey(), entry.getValue());
			}

			long endMillies = System.currentTimeMillis();
			long diff = (endMillies - startMillies) / 1000;
			long diffMinutes = diff / 60;
			logger.info("copy to cachemap finished in seconds:" + diff + " around " + diffMinutes + " minutes"
					+ " size:" + newCache.size() + " linking the new cache to the cache reference");

			RepositoryCache.setCache(newCache);
			// clear facette cache
			FacetteCache.getFacetteCache().clear();
			logger.info("Facettes cleared");
		} else {
			logger.error("cache rebuilding is only available for MCAlfrescoAPIClient");
		}
	}

	private static final int THREAD_COUNT = Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors() - 1));
	private ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT, r -> {
		Thread t = new Thread(r);
		t.setPriority(Thread.NORM_PRIORITY - 1);
		return t;
	});

	/**
	 * builds cache directly to the current cache object, those Objects that are
	 * already in cache will not be refreshed
	 * 
	 * usefull after a server reboot cause it's adjuvant to the cachbuilding by user
	 * actions
	 * 
	 * @param authenticationInfo
	 * @param rootfolderId
	 */
	public void buildStickyCache(HashMap authenticationInfo, String rootfolderId) throws Throwable {

		
		logger.info("preparing first level subfolders for folder: " + nodeService.getProperty(new NodeRef(Constants.storeRef,rootfolderId),ContentModel.PROP_NAME ));
		List<ChildAssociationRef> childAssocRefs = nodeService
				.getChildAssocs(new NodeRef(Constants.storeRef, rootfolderId));

		int i = 0;

		List<Callable<Void>> threads = new ArrayList<>();

		List<ChildAssociationRef> childRefsThread = new ArrayList<ChildAssociationRef>();

		long time = System.currentTimeMillis();

		logger.info("THREAD_COUNT:" + THREAD_COUNT);
		int modulo = (childAssocRefs.size() > THREAD_COUNT) ? (int) (childAssocRefs.size() / THREAD_COUNT) : 2;

		List<List<String>> threadNodes = new ArrayList<>();

		for (ChildAssociationRef childAssocRef : childAssocRefs) {

			childRefsThread.add(childAssocRef);
			final int nr = i;
			if (i % modulo == 0) {

				List<String> tmp = new ArrayList<>();
				for (ChildAssociationRef childRef : childRefsThread) {
					tmp.add(childRef.getChildRef().getId());
				}
				threadNodes.add(tmp);
				childRefsThread.clear();
			}

			i++;
		}

		int j = 0;
		for (List<String> threadData : threadNodes) {

			int nr = j;
			threads.add(() -> {

				RunAsWork<Void> runAs = new RunAsWork<Void>() {
					@Override
					public Void doWork() throws Exception {

						ApplicationContext applicationContext = AlfAppContextGate.getApplicationContext();

						ServiceRegistry sr = (ServiceRegistry) applicationContext
								.getBean(ServiceRegistry.SERVICE_REGISTRY);
						NodeService nodeService = sr.getNodeService();

						List<String> childRefPage = new ArrayList<>(threadData);
						logger.info("thread nr:" + nr + " got's " + childRefPage.size());
						MCAlfrescoAPIClient apiClient = new MCAlfrescoAPIClient();
						for (String cr : childRefPage) {
							long startMillies = System.currentTimeMillis();

							logger.info("thread nr:" + nr + "	starting getChildrenRecursive for folder:" + nodeService
									.getProperty(new NodeRef(Constants.storeRef, cr), ContentModel.PROP_NAME));

							try {
								apiClient.getChildrenRecursive(MCAlfrescoAPIClient.storeRef, cr,
										CCConstants.CCM_TYPE_IO, null, true);
							} catch (Throwable e) {
								logger.error("thread nr:" + nr + e.getMessage(), e);
							}
							long endMillies = System.currentTimeMillis();
							long diff = (endMillies - startMillies) / 1000;
							long diffMinutes = diff / 60;
						}

						return null;

					}
				};

				AuthenticationUtil.runAsSystem(runAs);

				return null;
			});

			j++;
		}

		logger.info("got " + threads.size() + " threads");
		executor.invokeAll(threads);
		time = (System.currentTimeMillis() - time);
		if (threads.size() > 0) {
			logger.info(THREAD_COUNT + " Threads finished (" + threads.size() + ", " + (time / 1000) + " s -> "
					+ (time / threads.size()) + "ms per entry)");
		}

		FacetteCache.getFacetteCache().clear();
		logger.info("Facettes cleared");

		/*
		 * MCAlfrescoAPIClient apiClient = (MCAlfrescoAPIClient)mcBaseClient; long
		 * startMillies = System.currentTimeMillis();
		 * logger.info("starting getChildrenRecursive"); HashMap<String, HashMap<String,
		 * Object>> childRecursive =
		 * apiClient.getChildrenRecursive(MCAlfrescoAPIClient.storeRef, rootfolderId,
		 * CCConstants.CCM_TYPE_IO, null, true); long endMillies =
		 * System.currentTimeMillis(); long diff = (endMillies - startMillies)/ 1000;
		 * long diffMinutes = diff / 60; logger.
		 * info("getChildrenRecursive returned. buildStickyCache finished in seconds:"
		 * +diff+" around "+diffMinutes+" minutes" + " size:" +
		 * childRecursive.size()+"."); FacetteCache.getFacetteCache().clear();
		 * logger.info("Facettes cleared");
		 */

	}

}
