/**
 *
 *  
 * 
 * 
 *	
 *
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 *
 */
package org.edu_sharing.repository.server.tools;

import java.io.File;
import java.util.Arrays;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.mail.internet.InternetAddress;
import javax.servlet.ServletContext;

import com.typesafe.config.Config;
import org.apache.commons.lang.StringUtils;
import org.apache.commons.mail.EmailException;
import org.apache.commons.mail.HtmlEmail;
import org.apache.commons.mail.SimpleEmail;
import org.apache.log4j.Logger;
import org.edu_sharing.alfresco.lightbend.LightbendConfigLoader;


public class Mail {
	

	public static String AUTH_TYPE_TLS = "tls";
	private org.apache.log4j.Category logger = null;

	private Config configSMTP = null;
	private Config config = null;

	public Mail() {
		logger = Logger.getInstance(Mail.class);
		try{
			config = LightbendConfigLoader.get().getConfig("repository.mail");
			configSMTP = config.getConfig("server.smtp");
		}catch(Exception e){
			logger.error(e.getMessage(),e);
		}
	}

	private void sendMail(String sender, String senderName, String receiver, String subject, String message) throws EmailException {
		logger.info("start mailing sender:" + sender + " receiver" + receiver + " message" + message);

		
		String mailServer = configSMTP.getString("host");
		int smtpPort = configSMTP.getInt("port");
		String username = configSMTP.getString("username");
		String password = configSMTP.getString("password");
		String authType = configSMTP.getString("authtype");
		logger.info("mailServer:" + mailServer + " smtpPort:" + smtpPort + "username:" + username + "password:" + password);
		SimpleEmail email = new SimpleEmail();
		
		
		email.setCharset("utf-8");
		
		email.setDebug(true);
		email.setHostName(mailServer);
		email.setSmtpPort((int) smtpPort);
		
		if(authType != null && !authType.trim().equals("")){
			if(authType.trim().equals(AUTH_TYPE_TLS)){
				email.setTLS(true);
			}else{
				logger.info("auth type "+authType +" not supported at the moment");
			}
		}
		
		

		if ((username != null && password != null) && (!username.trim().equals("") && !password.trim().equals(""))) {
			logger.info("email.setAuthentication()");
			email.setAuthentication(username, password);
		}
		try{
			logger.info("start sending mail...");
			logger.info("sender:" + sender);
			logger.info("receiver:" + receiver);
			logger.info("subject" + subject);
			logger.info("message:" + message);
			
			if(senderName != null){
				email.setFrom(sender, senderName);
			}else{
				email.setFrom(sender);
			}
			
			email.addTo(receiver);
			email.setSubject(subject);
			email.setMsg(message);
			email.send();
		}catch(EmailException e){
			if(e.getCause() != null && e.getCause().getClass().equals(javax.mail.SendFailedException.class)){
				logger.error("EmailException caused by javax.mail.SendFailedException: maybe wrong receiver");
				logger.error("sender:" + sender);
				logger.error("receiver:" + receiver);
				logger.error("subject" + subject);
				logger.error("message:" + message);
				logger.error("Exception Message:" + e.getMessage());
			}else throw e;
			
		}
		

	}
	private void sendMailHtml(ServletContext context, String sender, String senderName, String replyTo, String receiver, String subject, String message) throws EmailException {
		logger.info("start mailing sender:" + sender + " receiver" + receiver + " message" + message);

		String mailServer = configSMTP.getString("host");
		int smtpPort = configSMTP.getInt("port");
		String username = configSMTP.getString("username");
		String password = configSMTP.getString("password");
		String authType = configSMTP.getString("authtype");
		logger.info("mailServer:" + mailServer + " smtpPort:" + smtpPort + "username:" + username + "password:" + password);
		HtmlEmail email = new HtmlEmail();
		
		
		email.setCharset("utf-8");
		
		email.setDebug(true);
		email.setHostName(mailServer);
		email.setSmtpPort((int) smtpPort);
		
		if(authType != null && !authType.trim().equals("")){
			if(authType.toLowerCase().trim().equals(AUTH_TYPE_TLS)){
				email.setTLS(true);
			}else{
				logger.info("auth type "+authType +" not supported at the moment");
			}
		}
		
		

		if ((username != null && password != null) && (!username.trim().equals("") && !password.trim().equals(""))) {
			logger.info("email.setAuthentication()");
			email.setAuthentication(username, password);
		}
		try{
			logger.info("start sending mail...");
			logger.info("sender:" + sender);
			logger.debug("receiver:" + receiver);
			logger.debug("subject" + subject);
			logger.debug("message:" + message);
			
			if(senderName != null){
				email.setFrom(sender, senderName);
			}else{
				email.setFrom(sender);
			}
			
			email.addTo(receiver);
			email.setSubject(subject);
			if(replyTo != null && config.getBoolean("addReplyTo")) {
				try {
					email.setReplyTo(Arrays.asList(InternetAddress.parse(replyTo)));
				}catch(Throwable t){
					logger.info("Could not parse mail reply-to address: "+t.getMessage());
				}
			}
			message = replaceImages(context,email,message);
			
			email.setHtmlMsg(message);
			email.send();
		}catch(EmailException e){
			if(e.getCause() != null && e.getCause().getClass().equals(javax.mail.SendFailedException.class)){
				logger.error("EmailException caused by javax.mail.SendFailedException: maybe wrong receiver");
				logger.error("sender:" + sender);
				logger.error("receiver:" + receiver);
				logger.error("subject" + subject);
				logger.error("message:" + message);
				logger.error("Exception Message:" + e.getMessage());
			}else throw e;
			
		}
		

	}

	private String replaceImages(ServletContext context, HtmlEmail email, String message) throws EmailException {
		Pattern pattern = Pattern.compile("\\{\\{image:(.*?)}}");
		Matcher matcher = pattern.matcher(message);
		// check all occurance
		String result="";
		int lastIndex=0;
		while (matcher.find()) {
			result+=message.substring(lastIndex,matcher.start());
			String logo = context.getRealPath(matcher.group(1));
			result+="cid:"+email.embed(new File(logo));
			lastIndex=matcher.end();
		}
		result+=message.substring(lastIndex);
		return result;
	}

	public void sendMail(String receiver, String subject, String message) throws EmailException {
		sendMail(config.getString("from"), null, receiver, subject, message);
	}
	
	public void sendMail(String senderName, String receiver, String subject, String message) throws EmailException {
		sendMail(config.getString("from"),senderName, receiver, subject, message);
	}
	public void sendMailHtml(ServletContext context, String senderName, String replyTo, String receiver,String subject,String message,Map<String,String> replace) throws Exception {
		subject=replaceString(subject,replace);
		message=replaceString(message,replace);
		sendMailHtml(context,config.getString("from"),senderName, replyTo, receiver, subject, message);
	}
	public void sendMailHtml(ServletContext context,String receiver,String subject,String message,Map<String,String> replace) throws Exception {
		sendMailHtml(context,config.getString("from"), null, receiver, subject, message,replace);
	}

	private String replaceString(String string, Map<String, String> replace) throws Exception {
		if(replace!=null){
			for(String key : replace.keySet()){
				String value=replace.get(key);
				if(value==null)
					value="";
				string=string.replace("{{"+key+"}}",value);
			}
		}
		String[] conds=StringUtils.splitByWholeSeparator(string,"{{if ");
		try{
			for(int i=1;i<conds.length;i++){
				String cond=conds[i];
				boolean negate=false;
				if(cond.startsWith("!"))
					negate=true;
				if(negate)
					cond=cond.substring(1);
				int end=cond.indexOf("}}");
				String condVar=cond.substring(0,end);
				boolean isTrue=false;
				if(replace!=null){
					isTrue=replace.containsKey(condVar) && !replace.get(condVar).trim().isEmpty();
				}
				int endif=cond.indexOf("{{endif}}");
				String content=cond.substring(end+2,endif);
				conds[i]=isTrue ? content : "";
				conds[i]+=cond.substring(endif+9);
			}
		}catch(Throwable t){
			throw new Exception("Error evaluating if conditions in mail template, please check your template syntax",t);
		}
		string=StringUtils.join(conds,"");
		return string;
		
	}

	public Config getConfig() {
		return config;
	}
}
