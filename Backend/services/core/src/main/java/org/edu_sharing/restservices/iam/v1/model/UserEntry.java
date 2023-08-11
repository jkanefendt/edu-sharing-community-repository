package org.edu_sharing.restservices.iam.v1.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema;;

import org.edu_sharing.restservices.shared.User;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collection;


@Schema(description = "")
public class UserEntry  {
  
  private User person = null;
  private Boolean editProfile = null;

  private Collection<String> groups = null;

  
  /**
   **/
  @Schema(required = true, description = "")
  @JsonProperty("person")
  public User getPerson() {
    return person;
  }
  public void setPerson(User person) {
    this.person = person;
  }
  
  public void setEditProfile(Boolean editProfile) {
	this.editProfile = editProfile;
  }
  
  public Boolean getEditProfile() {
	return editProfile;
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public Collection<String> getGroups() {
    return groups;
  }

  public void setGroups(Collection<String> groups) {
    this.groups = groups;
  }

  @Override
  public String toString()  {
    StringBuilder sb = new StringBuilder();
    sb.append("class UserEntry {\n");
    
    sb.append("  person: ").append(person).append("\n");
    sb.append("}\n");
    return sb.toString();
  }
}
