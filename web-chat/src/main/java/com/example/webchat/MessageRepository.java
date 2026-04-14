package com.example.webchat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MessageRepository extends JpaRepository<Message, Long> {

    Optional<Message> findBySenderAndClientMessageIdAndChannel_Id(String sender, String clientMessageId, Long channelId);

    @Query("SELECT m FROM Message m WHERE m.channel.id = :channelId AND (:beforeId IS NULL OR m.id < :beforeId) ORDER BY m.id DESC")
    List<Message> findHistoryPage(
            @Param("channelId") long channelId,
            @Param("beforeId") Long beforeId,
            Pageable pageable
    );

    @Query("SELECT m FROM Message m WHERE m.channel.id = :channelId ORDER BY m.id ASC")
    List<Message> findByChannelIdOrderByIdAsc(@Param("channelId") long channelId, Pageable pageable);

    @Modifying
    @Query("UPDATE Message m SET m.channel = :ch WHERE m.channel IS NULL")
    int clearNullChannels(@Param("ch") Channel ch);
}
