package com.example.webchat;

import com.example.webchat.dto.ChannelResponse;
import com.example.webchat.dto.CreateChannelRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class ChannelService {

    private final ChannelRepository channelRepository;

    public ChannelService(ChannelRepository channelRepository) {
        this.channelRepository = channelRepository;
    }

    public List<ChannelResponse> listAll() {
        return channelRepository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ChannelResponse create(CreateChannelRequest request, String creatorUsername) {
        String base = slugify(request.name());
        String slug = ensureUniqueSlug(base);
        Channel ch = new Channel(
                request.name().trim(),
                slug,
                request.description() != null ? request.description().trim() : null,
                LocalDateTime.now(),
                creatorUsername
        );
        ch = channelRepository.save(ch);
        return toResponse(ch);
    }

    private ChannelResponse toResponse(Channel c) {
        return new ChannelResponse(c.getId(), c.getName(), c.getSlug(), c.getDescription(), c.getCreatedAt());
    }

    static String slugify(String raw) {
        if (raw == null) {
            return "channel";
        }
        String s = raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return s.isEmpty() ? "channel" : s;
    }

    private String ensureUniqueSlug(String base) {
        String slug = base;
        int i = 2;
        while (channelRepository.existsBySlug(slug)) {
            slug = base + "-" + i;
            i++;
        }
        return slug;
    }

    public Channel getByIdOrThrow(long id) {
        return channelRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "channel_not_found"));
    }
}
