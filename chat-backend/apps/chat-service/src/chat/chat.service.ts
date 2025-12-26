import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MessageType } from './schemas/message.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import {
  Message,
  MessageDocument,
  MessageStatus,
} from './schemas/message.schema';
import { Nickname, NicknameDocument } from './schemas/nickname.schema';
import {
  CreateConversationDto,
  SendMessageDto,
  UpdateMessageDto,
  MessageSearchDto,
  MessageSearchResultDto,
  UpdateMessageStatusDto,
  MarkMessagesAsReadDto,
  MessageStatusResponseDto,
} from '@app/contracts';

@Injectable()
export class ChatService {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;

  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
    @InjectModel(Nickname.name)
    private nicknameModel: Model<NicknameDocument>,
  ) {
    // Load pagination settings from environment variables
    this.defaultPageSize = parseInt(process.env.DEFAULT_PAGE_SIZE || '50', 10);
    this.maxPageSize = parseInt(process.env.MAX_PAGE_SIZE || '100', 10);
  }

  // ============ CONVERSATIONS ============

  async createConversation(
    dto: CreateConversationDto,
    currentUserId: number,
  ): Promise<ConversationDocument> {
    // Ensure current user is in participants
    const participants = Array.from(
      new Set([currentUserId, ...dto.participants]),
    );

    // Validate private conversation has exactly 2 participants
    if (dto.type === 'private' && participants.length !== 2) {
      throw new BadRequestException(
        'Private conversation must have exactly 2 participants',
      );
    }

    // Check if private conversation already exists
    if (dto.type === 'private') {
      const existing = await this.conversationModel.findOne({
        type: 'private',
        participants: { $all: participants, $size: 2 },
      });
      if (existing) {
        return existing;
      }
    }

    const conversationData: any = {
      type: dto.type,
      participants,
      status: dto.type === 'group' ? 'accepted' : 'pending',
      initiator_id: currentUserId,
    };

    // For group chats, set admin and optional metadata
    if (dto.type === 'group') {
      conversationData.admin_id = currentUserId; // Creator is admin
      if (dto.name) conversationData.name = dto.name;
      if (dto.avatar) conversationData.avatar = dto.avatar;
    }

    const conversation = new this.conversationModel(conversationData);
    return conversation.save();
  }

  findConversationsByUser(
    userId: number,
    limit?: number,
    skip?: number,
  ): Promise<ConversationDocument[]> {
    // Apply pagination limits
    const pageSize =
      limit && limit <= this.maxPageSize ? limit : this.defaultPageSize;
    const skipCount = skip || 0;

    return this.conversationModel
      .find({ participants: userId })
      .populate('last_message_id')
      .sort({ updated_at: -1 })
      .skip(skipCount)
      .limit(pageSize)
      .exec() as unknown as Promise<ConversationDocument[]>;
  }

  async findConversationById(
    conversationId: string,
  ): Promise<ConversationDocument> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation ID');
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async deleteConversation(
    conversationId: string,
    userId: number,
  ): Promise<void> {
    const conversation = await this.findConversationById(conversationId);

    // For group chats, only admin can delete
    if (conversation.type === 'group') {
      if (conversation.admin_id !== userId) {
        throw new ForbiddenException(
          'Only admin can delete group conversation',
        );
      }
    } else {
      // For private chats, any participant can delete
      if (!conversation.participants.includes(userId)) {
        throw new ForbiddenException(
          'You are not a participant in this conversation',
        );
      }
    }

    // Delete all messages in this conversation
    await this.messageModel
      .deleteMany({ conversation_id: conversationId })
      .exec();

    // Delete the conversation
    await this.conversationModel.findByIdAndDelete(conversationId).exec();
  }

  async getConversationMembers(
    conversationId: string,
    userId: number,
  ): Promise<number[]> {
    const conversation = await this.findConversationById(conversationId);

    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    return conversation.participants;
  }

  async addMember(
    conversationId: string,
    newUserId: number,
    currentUserId: number,
    newUserName?: string,
    actorName?: string,
  ): Promise<{ conversation: ConversationDocument; systemMessage: MessageDocument | null }> {
    const conversation = await this.findConversationById(conversationId);

    if (!conversation.participants.includes(currentUserId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    if (conversation.type === 'private') {
      throw new BadRequestException(
        'Cannot add members to a private conversation',
      );
    }

    if (conversation.participants.includes(newUserId)) {
      throw new BadRequestException('User is already a member');
    }

    conversation.participants.push(newUserId);
    const savedConversation = await conversation.save();

    // Create system message for member added - use username if provided
    const userDisplayName = newUserName || `User ${newUserId}`;
    const actorDisplayName = actorName || `User ${currentUserId}`;

    // Check if adding self (shouldn't happen, but handle it)
    const isSelfAdd = newUserId === currentUserId;
    const messageContent = isSelfAdd
      ? `${userDisplayName} đã gia nhập nhóm`
      : `${userDisplayName} đã được thêm bởi ${actorDisplayName}`;

    const systemMessage = await this.createSystemMessage(
      conversationId,
      messageContent,
      {
        event: 'member_added',
        userId: newUserId,
        actorId: currentUserId,
        actorName: actorDisplayName,
        targetName: userDisplayName,
      },
    );

    return { conversation: savedConversation, systemMessage };
  }

  async removeMember(
    conversationId: string,
    userIdToRemove: number,
    currentUserId: number,
    userNameToRemove?: string,
  ): Promise<{ conversation: ConversationDocument; systemMessage: MessageDocument | null }> {
    const conversation = await this.findConversationById(conversationId);

    if (conversation.type === 'private') {
      throw new BadRequestException(
        'Cannot remove members from a private conversation',
      );
    }

    if (!conversation.participants.includes(userIdToRemove)) {
      throw new BadRequestException(
        'User is not a member of this conversation',
      );
    }

    // Admin or moderators can remove anyone (except admin)
    // Regular members can only remove themselves
    if (userIdToRemove === conversation.admin_id) {
      throw new BadRequestException('Cannot remove admin from group');
    }

    const canRemove =
      currentUserId === userIdToRemove || // Self-remove
      this.isAdminOrModerator(conversation, currentUserId); // Admin/moderator

    if (!canRemove) {
      throw new ForbiddenException(
        'Only admin/moderators can remove other members',
      );
    }

    // Remove from participants
    conversation.participants = conversation.participants.filter(
      (id) => id !== userIdToRemove,
    );

    // Remove from moderators if applicable
    if (conversation.moderator_ids) {
      conversation.moderator_ids = conversation.moderator_ids.filter(
        (id) => id !== userIdToRemove,
      );
    }

    const savedConversation = await conversation.save();

    // Create system message for member removed - use username if provided
    const userDisplayName = userNameToRemove || `User ${userIdToRemove}`;
    const isSelfRemove = currentUserId === userIdToRemove;
    const systemMessage = await this.createSystemMessage(
      conversationId,
      isSelfRemove
        ? `${userDisplayName} đã rời nhóm`
        : `${userDisplayName} đã bị xóa khỏi nhóm`,
      {
        event: 'member_removed',
        userId: userIdToRemove,
        actorId: currentUserId,
      },
    );

    return { conversation: savedConversation, systemMessage };
  }

  // ============ MESSAGES ============

  async sendMessage(
    conversationId: string,
    dto: SendMessageDto,
    senderId: number,
  ): Promise<MessageDocument> {
    const conversation = await this.findConversationById(conversationId);

    if (!conversation.participants.includes(senderId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Check conversation status
    if (conversation.status === 'declined') {
      throw new ForbiddenException('Message request was declined');
    }

    if (conversation.status === 'pending') {
      // Only initiator can send first message
      if (senderId !== conversation.initiator_id) {
        throw new ForbiddenException(
          'Please accept the message request before replying',
        );
      }
    }

    const message = new this.messageModel({
      conversation_id: new Types.ObjectId(conversationId),
      sender_id: senderId,
      content: dto.content,
      attachments: dto.attachments || [],
      seen_by: [senderId], // Sender has "seen" their own message
      status: MessageStatus.SENT,
      delivery_info: [
        {
          user_id: senderId,
          status: MessageStatus.SENT,
          timestamp: new Date(),
        },
      ],
    });

    const savedMessage = await message.save();

    // Update conversation with last_message_id
    await this.conversationModel.findByIdAndUpdate(
      conversationId,
      {
        last_message_id: savedMessage._id,
        status: 'accepted', // Auto-accept pending conversations on first message
      },
    ).exec();

    return savedMessage;
  }

  async getMessages(
    conversationId: string,
    userId: number,
    limit?: number,
    before?: Date,
  ): Promise<MessageDocument[]> {
    console.log('[ChatService] getMessages called - conversationId:', conversationId, 'userId:', userId, 'limit:', limit);

    const conversation = await this.findConversationById(conversationId);
    console.log('[ChatService] Conversation found:', conversation._id, 'participants:', conversation.participants);

    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Validate and apply pagination limits
    let pageSize = limit || this.defaultPageSize;
    if (pageSize > this.maxPageSize) {
      pageSize = this.maxPageSize;
    }
    if (pageSize < 1) {
      pageSize = this.defaultPageSize;
    }

    interface MessageQuery {
      conversation_id: Types.ObjectId;
      created_at?: { $lt: Date };
    }

    const query: MessageQuery = {
      conversation_id: new Types.ObjectId(conversationId),
    };
    if (before) {
      query.created_at = { $lt: before };
    }

    console.log('[ChatService] Executing MongoDB query:', JSON.stringify(query), 'pageSize:', pageSize);

    const messages = await this.messageModel
      .find(query)
      .sort({ created_at: -1 })
      .limit(pageSize)
      .exec() as unknown as MessageDocument[];

    console.log('[ChatService] MongoDB returned messages count:', messages.length);
    return messages;
  }

  async searchMessages(
    dto: MessageSearchDto,
    userId: number,
  ): Promise<MessageSearchResultDto> {
    // Validate pagination
    let limit = dto.limit || this.defaultPageSize;
    if (limit > this.maxPageSize) {
      limit = this.maxPageSize;
    }
    const skip = dto.skip || 0;

    // Build search query
    interface SearchQuery {
      $text?: { $search: string };
      conversation_id?: Types.ObjectId;
      sender_id?: number;
      created_at?: {
        $gte?: Date;
        $lte?: Date;
      };
    }

    const searchQuery: SearchQuery = {
      $text: { $search: dto.query },
    };

    // Filter by conversation (must verify user is participant)
    if (dto.conversationId) {
      if (!Types.ObjectId.isValid(dto.conversationId)) {
        throw new BadRequestException('Invalid conversation ID');
      }

      const conversation = await this.findConversationById(dto.conversationId);
      if (!conversation.participants.includes(userId)) {
        throw new ForbiddenException(
          'You are not a participant in this conversation',
        );
      }

      searchQuery.conversation_id = new Types.ObjectId(dto.conversationId);
    } else {
      // If no conversationId, only search in conversations user participates in
      const userConversations = await this.conversationModel
        .find({ participants: userId })
        .select('_id')
        .exec();

      const conversationIds = userConversations.map((c) => c._id);
      if (conversationIds.length === 0) {
        return {
          messages: [],
          total: 0,
          skip,
          limit,
          query: dto.query,
        };
      }

      searchQuery.conversation_id = { $in: conversationIds } as any;
    }

    // Filter by sender
    if (dto.senderId) {
      searchQuery.sender_id = dto.senderId;
    }

    // Filter by date range
    if (dto.startDate || dto.endDate) {
      searchQuery.created_at = {};
      if (dto.startDate) {
        searchQuery.created_at.$gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        searchQuery.created_at.$lte = new Date(dto.endDate);
      }
    }

    // Execute search with text score for relevance sorting
    const [messages, total] = await Promise.all([
      this.messageModel
        .find(searchQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments(searchQuery).exec(),
    ]);

    return {
      messages,
      total,
      skip,
      limit,
      query: dto.query,
    };
  }

  async findMessageById(messageId: string): Promise<MessageDocument> {
    if (!Types.ObjectId.isValid(messageId)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(messageId).exec();
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  async updateMessage(
    messageId: string,
    dto: UpdateMessageDto,
    userId: number,
  ): Promise<MessageDocument> {
    const message = await this.findMessageById(messageId);

    if (message.sender_id !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    message.content = dto.content;
    return message.save();
  }

  async deleteMessage(messageId: string, userId: number): Promise<void> {
    const message = await this.findMessageById(messageId);

    // TODO: Add admin check if needed
    if (message.sender_id !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageModel.findByIdAndDelete(messageId).exec();
  }

  async markMessageAsRead(
    messageId: string,
    userId: number,
  ): Promise<MessageDocument> {
    const message = await this.findMessageById(messageId);

    // Verify user is participant
    const conversation = await this.conversationModel
      .findById(message.conversation_id)
      .exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    if (!message.seen_by.includes(userId)) {
      message.seen_by.push(userId);
    }

    // Update delivery info
    const existingInfo = message.delivery_info.find(
      (info) => info.user_id === userId,
    );

    if (existingInfo) {
      existingInfo.status = MessageStatus.READ;
      existingInfo.timestamp = new Date();
    } else {
      message.delivery_info.push({
        user_id: userId,
        status: MessageStatus.READ,
        timestamp: new Date(),
      });
    }

    // Update read_at if all participants have read
    const allRead = conversation.participants.every(
      (participantId) =>
        participantId === message.sender_id ||
        message.delivery_info.some(
          (info) =>
            info.user_id === participantId &&
            info.status === MessageStatus.READ,
        ),
    );

    if (allRead && !message.read_at) {
      message.read_at = new Date();
      message.status = MessageStatus.READ;
    }

    await message.save();
    return message;
  }

  // ============ MESSAGE DELIVERY STATUS ============

  async updateMessageStatus(
    messageId: string,
    dto: UpdateMessageStatusDto,
    userId: number,
  ): Promise<MessageDocument> {
    const message = await this.findMessageById(messageId);

    // Verify user is participant
    const conversation = await this.conversationModel
      .findById(message.conversation_id)
      .exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Update delivery info for this user
    const existingInfo = message.delivery_info.find(
      (info) => info.user_id === userId,
    );

    if (existingInfo) {
      // Only allow status progression (sent -> delivered -> read)
      const statusOrder = {
        [MessageStatus.SENT]: 0,
        [MessageStatus.DELIVERED]: 1,
        [MessageStatus.READ]: 2,
        [MessageStatus.FAILED]: -1,
      };

      const currentStatus = String(dto.status);

      if (
        statusOrder[dto.status] >= statusOrder[existingInfo.status] ||
        currentStatus === String(MessageStatus.FAILED)
      ) {
        existingInfo.status = dto.status;
        existingInfo.timestamp = new Date();
      }
    } else {
      message.delivery_info.push({
        user_id: userId,
        status: dto.status,
        timestamp: new Date(),
      });
    }

    // Update message-level status and timestamps
    this.updateMessageLevelStatus(message, conversation.participants);

    await message.save();
    return message;
  }

  async markMessagesAsDelivered(
    messageIds: string[],
    userId: number,
  ): Promise<void> {
    for (const messageId of messageIds) {
      try {
        await this.updateMessageStatus(
          messageId,
          { status: MessageStatus.DELIVERED },
          userId,
        );
      } catch {
        // Skip messages that user doesn't have access to
        continue;
      }
    }
  }

  async markMessagesAsRead(
    dto: MarkMessagesAsReadDto,
    userId: number,
  ): Promise<void> {
    for (const messageId of dto.messageIds) {
      try {
        await this.markMessageAsRead(messageId, userId);
      } catch {
        // Skip messages that user doesn't have access to
        continue;
      }
    }
  }

  async markConversationAsRead(
    conversationId: string,
    userId: number,
  ): Promise<void> {
    const conversation = await this.findConversationById(conversationId);

    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Get all unread messages in this conversation
    const unreadMessages = await this.messageModel
      .find({
        conversation_id: new Types.ObjectId(conversationId),
        sender_id: { $ne: userId }, // Not sent by current user
        seen_by: { $ne: userId }, // Not already seen
      })
      .exec();

    // Mark all as read
    for (const message of unreadMessages) {
      if (!message.seen_by.includes(userId)) {
        message.seen_by.push(userId);
      }

      const existingInfo = message.delivery_info.find(
        (info) => info.user_id === userId,
      );

      if (existingInfo) {
        existingInfo.status = MessageStatus.READ;
        existingInfo.timestamp = new Date();
      } else {
        message.delivery_info.push({
          user_id: userId,
          status: MessageStatus.READ,
          timestamp: new Date(),
        });
      }

      // Update message-level status
      this.updateMessageLevelStatus(message, conversation.participants);

      await message.save();
    }
  }

  async getMessageStatus(
    messageId: string,
    userId: number,
  ): Promise<MessageStatusResponseDto> {
    const message = await this.findMessageById(messageId);

    // Verify user is participant
    const conversation = await this.conversationModel
      .findById(message.conversation_id)
      .exec();
    if (!conversation || !conversation.participants.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    return {
      message_id: messageId,
      status: message.status,
      delivery_info: message.delivery_info,
      created_at: message.created_at,
      delivered_at: message.delivered_at,
      read_at: message.read_at,
    };
  }

  private updateMessageLevelStatus(
    message: MessageDocument,
    participants: number[],
  ): void {
    const recipients = participants.filter((id) => id !== message.sender_id);

    if (recipients.length === 0) {
      return;
    }

    // Check if all recipients have received/read
    const allDelivered = recipients.every((recipientId) =>
      message.delivery_info.some(
        (info) =>
          info.user_id === recipientId &&
          (info.status === MessageStatus.DELIVERED ||
            info.status === MessageStatus.READ),
      ),
    );

    const allRead = recipients.every((recipientId) =>
      message.delivery_info.some(
        (info) =>
          info.user_id === recipientId && info.status === MessageStatus.READ,
      ),
    );

    if (allRead) {
      message.status = MessageStatus.READ;
      if (!message.read_at) {
        message.read_at = new Date();
      }
    } else if (allDelivered) {
      message.status = MessageStatus.DELIVERED;
      if (!message.delivered_at) {
        message.delivered_at = new Date();
      }
    }
  }

  async getUnreadCount(userId: number): Promise<number> {
    // Get all conversations for this user
    const conversations = await this.conversationModel
      .find({ participants: userId })
      .exec();
    const conversationIds: Types.ObjectId[] = conversations.map(
      (c) => c._id,
    ) as any;

    // Count messages where user is participant but hasn't seen
    const count = await this.messageModel
      .countDocuments({
        conversation_id: { $in: conversationIds },
        sender_id: { $ne: userId }, // Exclude own messages
        seen_by: { $ne: userId }, // Not in seen_by array
      })
      .exec();

    return count;
  }

  // ============ MESSAGE REQUESTS ============

  async acceptMessageRequest(
    conversationId: string,
    userId: number,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversationById(conversationId);

    // Only recipient can accept
    if (userId === conversation.initiator_id) {
      throw new ForbiddenException('Cannot accept your own message request');
    }

    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    if (conversation.status !== 'pending') {
      throw new BadRequestException(
        `Cannot accept request with status: ${conversation.status}`,
      );
    }

    conversation.status = 'accepted';
    return conversation.save();
  }

  async declineMessageRequest(
    conversationId: string,
    userId: number,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversationById(conversationId);

    // Only recipient can decline
    if (userId === conversation.initiator_id) {
      throw new ForbiddenException('Cannot decline your own message request');
    }

    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException('You are not part of this conversation');
    }

    if (conversation.status !== 'pending') {
      throw new BadRequestException(
        `Cannot decline request with status: ${conversation.status}`,
      );
    }

    conversation.status = 'declined';
    return conversation.save();
  }

  async getPendingRequests(userId: number): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({
        participants: userId,
        status: 'pending',
        initiator_id: { $ne: userId }, // Only requests received, not sent
      })
      .sort({ created_at: -1 })
      .exec() as unknown as Promise<ConversationDocument[]>;
  }

  // ============ GROUP ADMIN FUNCTIONS ============

  async updateGroupInfo(
    conversationId: string,
    userId: number,
    name?: string,
    avatar?: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversationById(conversationId);

    if (conversation.type !== 'group') {
      throw new BadRequestException('Only group conversations can be updated');
    }

    // Only admin or moderators can update group info
    if (!this.isAdminOrModerator(conversation, userId)) {
      throw new ForbiddenException(
        'Only admin or moderators can update group info',
      );
    }

    if (name) conversation.name = name;
    if (avatar) conversation.avatar = avatar;

    return conversation.save();
  }

  async promoteToModerator(
    conversationId: string,
    adminUserId: number,
    targetUserId: number,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversationById(conversationId);

    if (conversation.type !== 'group') {
      throw new BadRequestException('Only group conversations have moderators');
    }

    // Only admin can promote
    if (conversation.admin_id !== adminUserId) {
      throw new ForbiddenException('Only admin can promote moderators');
    }

    if (!conversation.participants.includes(targetUserId)) {
      throw new BadRequestException('User is not in this group');
    }

    if (!conversation.moderator_ids) {
      conversation.moderator_ids = [];
    }

    if (!conversation.moderator_ids.includes(targetUserId)) {
      conversation.moderator_ids.push(targetUserId);
    }

    return conversation.save();
  }

  async demoteModerator(
    conversationId: string,
    adminUserId: number,
    targetUserId: number,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversationById(conversationId);

    if (conversation.type !== 'group') {
      throw new BadRequestException('Only group conversations have moderators');
    }

    // Only admin can demote
    if (conversation.admin_id !== adminUserId) {
      throw new ForbiddenException('Only admin can demote moderators');
    }

    if (conversation.moderator_ids) {
      conversation.moderator_ids = conversation.moderator_ids.filter(
        (id) => id !== targetUserId,
      );
    }

    return conversation.save();
  }

  async transferAdmin(
    conversationId: string,
    currentAdminId: number,
    newAdminId: number,
  ): Promise<ConversationDocument> {
    const conversation = await this.findConversationById(conversationId);

    if (conversation.type !== 'group') {
      throw new BadRequestException('Only group conversations have admin');
    }

    // Only current admin can transfer
    if (conversation.admin_id !== currentAdminId) {
      throw new ForbiddenException(
        'Only current admin can transfer admin role',
      );
    }

    if (!conversation.participants.includes(newAdminId)) {
      throw new BadRequestException('New admin must be in the group');
    }

    conversation.admin_id = newAdminId;

    // Remove new admin from moderators if they were one
    if (conversation.moderator_ids) {
      conversation.moderator_ids = conversation.moderator_ids.filter(
        (id) => id !== newAdminId,
      );
    }

    return conversation.save();
  }

  // Helper to check if user is conversation participant
  async isParticipant(
    conversationId: string,
    userId: number,
  ): Promise<boolean> {
    if (!Types.ObjectId.isValid(conversationId)) {
      return false;
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    return conversation ? conversation.participants.includes(userId) : false;
  }

  // Helper: Create system message
  private async createSystemMessage(
    conversationId: string,
    content: string,
    systemData: {
      event: 'member_added' | 'member_removed' | 'group_created' | 'group_deleted';
      userId?: number;
      actorId?: number;
      actorName?: string;
      targetName?: string;
    },
  ): Promise<MessageDocument> {
    const message = new this.messageModel({
      conversation_id: new Types.ObjectId(conversationId),
      sender_id: 0, // System messages have sender_id = 0
      content,
      type: MessageType.SYSTEM,
      system_data: systemData,
      seen_by: [],  // System messages are not "seen" by anyone initially
      status: MessageStatus.SENT,
      delivery_info: [],
    });

    return message.save();
  }

  // ============ NICKNAMES ============

  async setNickname(
    conversationId: string,
    ownerId: number,
    targetUserId: number,
    nickname: string,
  ): Promise<NicknameDocument> {
    // Validate inputs
    if (!nickname || nickname.trim().length === 0) {
      throw new BadRequestException('Nickname cannot be empty');
    }
    if (nickname.trim().length > 50) {
      throw new BadRequestException('Nickname cannot exceed 50 characters');
    }

    // Verify conversation exists
    const conversation = await this.findConversationById(conversationId);

    // Verify both users are participants
    if (!conversation.participants.includes(ownerId) || !conversation.participants.includes(targetUserId)) {
      throw new ForbiddenException('Both users must be participants in this conversation');
    }

    // Upsert nickname
    const existing = await this.nicknameModel.findOne({
      conversation_id: new Types.ObjectId(conversationId),
      owner_id: ownerId,
      target_user_id: targetUserId,
    });

    if (existing) {
      existing.nickname = nickname.trim();
      return existing.save();
    }

    return this.nicknameModel.create({
      conversation_id: new Types.ObjectId(conversationId),
      owner_id: ownerId,
      target_user_id: targetUserId,
      nickname: nickname.trim(),
    });
  }

  async removeNickname(
    conversationId: string,
    ownerId: number,
    targetUserId: number,
  ): Promise<void> {
    const result = await this.nicknameModel.deleteOne({
      conversation_id: new Types.ObjectId(conversationId),
      owner_id: ownerId,
      target_user_id: targetUserId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Nickname not found');
    }
  }

  async getNicknames(
    conversationId: string,
    ownerId: number,
  ): Promise<NicknameDocument[]> {
    return this.nicknameModel.find({
      conversation_id: new Types.ObjectId(conversationId),
      owner_id: ownerId,
    });
  }

  async getNickname(
    conversationId: string,
    ownerId: number,
    targetUserId: number,
  ): Promise<string | null> {
    const nickname = await this.nicknameModel.findOne({
      conversation_id: new Types.ObjectId(conversationId),
      owner_id: ownerId,
      target_user_id: targetUserId,
    });

    return nickname ? nickname.nickname : null;
  }

  // Helper: Check if user is admin or moderator
  private isAdminOrModerator(
    conversation: ConversationDocument,
    userId: number,
  ): boolean {
    return (
      conversation.admin_id === userId ||
      (conversation.moderator_ids || []).includes(userId)
    );
  }
}
