package org.edu_sharing.service.nodeservice;

import org.apache.http.HttpHeaders;
import org.edu_sharing.alfresco.repository.server.authentication.Context;

import java.net.URI;
import java.net.URISyntaxException;

public class CallSourceHelper {
    enum CallSource {
        Search,
        Render,
        Preview,
        Sitemap,
        Workspace,
        Unknown
    }

    public static CallSource getCallSource(){
        if(Context.getCurrentInstance() == null || Context.getCurrentInstance().getRequest() == null){
            return CallSource.Unknown;
        }

        String requestPath = "";
        String refererPath = "";
        if(Context.getCurrentInstance() != null) {
            String requestURI = Context.getCurrentInstance().getRequest().getRequestURI();
            String referer =  Context.getCurrentInstance().getRequest().getHeader(HttpHeaders.REFERER);

            try {
                requestPath = new URI(requestURI).getPath();
                if(referer != null){
                    refererPath = new URI(referer).getPath();
                }
            } catch (URISyntaxException e) {
               //
            }

        }

        if(isSearch(requestPath)){
            return CallSource.Search;
        }else if(isRender(requestPath) || (isRender(refererPath))){
            return CallSource.Render;
        }else if(isPreview(requestPath)){
            return CallSource.Preview;
        }else if(isSitemap(requestPath)){
            return CallSource.Sitemap;
        }else{
            return CallSource.Workspace;
        }
    }

    private static boolean isSearch(String path){
        if(path.startsWith("/edu-sharing/rest/search")){
            return true;
        }
        return false;
    }

    private static boolean isRender(String path){
        if(path.startsWith("/edu-sharing/components/render")
                || path.startsWith("/edu-sharing/rest/rendering")
                || path.startsWith("/edu-sharing/eduservlet/render")
                || path.startsWith("/edu-sharing/content")){
            return true;
        }
        return false;
    }

    private static boolean isPreview(String path){
        if(path.startsWith("/edu-sharing/preview")){
            return true;
        }
        return false;
    }

    private static boolean isSitemap(String path){
        if(path.startsWith("/edu-sharing/eduservlet/sitemap")){
            return true;
        }
        return false;
    }
}
