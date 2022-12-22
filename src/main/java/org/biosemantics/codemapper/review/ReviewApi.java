package org.biosemantics.codemapper.review;

import static org.biosemantics.codemapper.persistency.PersistencyApi.timestampToString;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.review.Topic.Resolved;

public class ReviewApi {

    private DataSource connectionPool;

	public ReviewApi(DataSource connectionPool) {
	    this.connectionPool = connectionPool;
	}
	
	public void newMessage(String project, String mapping, String cui, int topicId, String content, String user) throws CodeMapperException {
		String query = "SELECT * FROM review_new_message(?, ?, ?, ?, ?, ?)";

        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
        	statement.setString(1, project);
        	statement.setString(2, mapping);
        	statement.setString(3, cui);
        	statement.setInt(4, topicId);
        	statement.setString(5, content);
        	statement.setString(6, user);
			statement.executeQuery();
        } catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to create message", e);
		}
	}
	
	public void newTopic(String project, String mapping, String cui, String heading, String user) throws CodeMapperException {
		String query = "SELECT * FROM review_new_topic(?, ?, ?, ?, ?)";

        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
        	statement.setString(1, project);
        	statement.setString(2, mapping);
        	statement.setString(3, cui);
        	statement.setString(4, heading);
        	statement.setString(5, user);
			statement.executeQuery();
        } catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to create topic", e);
		}
	}

	public Map<String, Map<Integer, Topic>> getAll(String project, String mapping, String user) throws CodeMapperException {
		String query = "SELECT * FROM review_all_messages(?::TEXT, ?::TEXT, ?::TEXT)";
		
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
        	statement.setString(1, project);
        	statement.setString(2, mapping);
        	statement.setString(3, user);
        	Map<String, Map<Integer, Topic>> topicsByCUI = new HashMap<>();
			ResultSet result = statement.executeQuery();
			while (result.next()) {
				int ix = 1;
				String cui = result.getString(ix++);
				int topicID = result.getInt(ix++);
				String topicHeading = result.getString(ix++);
				boolean isResolved = result.getBoolean(ix++);
				String resolvedUser = result.getString(ix++);
				Timestamp resolvedTime = result.getTimestamp(ix++);
				int messageId = result.getInt(ix++);
				String messageAuthor = result.getString(ix++);
				Timestamp messageTime = result.getTimestamp(ix++);
				String messageContent = result.getString(ix++);
				boolean messageIsRead = result.getBoolean(ix++);
				Resolved resolved;
				if (isResolved) {
					assert (resolvedUser != null && resolvedTime != null);
					resolved = new Resolved(resolvedUser, timestampToString(resolvedTime));
				} else {
					resolved = null;
				}
				
				Topic topic = topicsByCUI
						.computeIfAbsent(cui, key -> new HashMap<>())
						.computeIfAbsent(topicID, key -> new Topic(topicID, topicHeading, resolved));
				if (messageId != 0) {
					Message message = new Message(messageId, messageAuthor, timestampToString(messageTime), messageContent, messageIsRead);
					topic.messages.add(message);
				}
			}
			return topicsByCUI;
		}  catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to get all review messages", e);
		}
	}

	public void resolveTopic(int topicId, String username) throws CodeMapperException {
		if (topicId == 0 || username == "") {
			throw CodeMapperException.user("invalid parameters to resolve topic");
		}
		String query = "SELECT * FROM review_resolve_topic(?, ?::TEXT)";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
        	statement.setInt(1, topicId);
        	statement.setString(2, username);
        	statement.execute();
        } catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to resolve topic", e);
        }
	}

	public void resetReadMarkers(int topicId) throws CodeMapperException {
		if (topicId == 0) {
			throw CodeMapperException.user("invalid parameters to reset read markers");
		}
		String query = "SELECT * FROM review_reset_mark_read(?)";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
        	statement.setInt(1, topicId);
        	statement.execute();
        } catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to reset read markers", e);
        }
	}

	public void markRead(int topicId, String username) throws CodeMapperException {
		String query = "SELECT * FROM review_mark_topic_read(?, ?::TEXT)";
        try (Connection connection = connectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
        	statement.setInt(1, topicId);
        	statement.setString(2, username);
        	statement.execute();
        } catch (SQLException e) {
			throw CodeMapperException.server("Cannot execute query to resolve topic", e);
        }
	}
}
