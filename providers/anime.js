const _ = require("lodash");
const axios = require("axios");
const Provider = require(".");
const Paginator = require("../models/paginator");
const { keyboard, keypad } = require("../utils/bot-helper");

const botTGname = process.env.TG_BOT_NAME;

module.exports = class Anime extends Provider {
	constructor(bot) {
		super(bot);
		this.type = "anime";
		this.endpoint = process.env.GOPHIE_API;
	}

	/**
	 * List anime
	 * @param  {} message
	 * @param  {} page=1
	 */
	async list({ chat }, page = 1) {
		const { message_id } = await this.bot.sendMessage(
			chat.id,
			"\u{1F4E1} Fetching latest anime",
			keyboard
		);

		await this.bot.sendChatAction(chat.id, "typing");
		const { data } = await axios.get(`${this.endpoint}/list`, {
			params: { page, engine: "animeout" },
		});

		const pages = [],
			promises = [],
			paging = data.pop();

		_.map(data, anime => {
			const options = { parse_mode: "html" };
			options.reply_markup = JSON.stringify({
				inline_keyboard: [
					[
						{ text: keypad.download, url: anime.DownloadLink },
						{
							text: "Share",
							url: `https://t.me/share/url?url=${anime.DownloadLink}&text=Downloaded%20from%20@${botTGname}`,
						},
					],
				],
			});

			promises.push(
				this.bot
					.sendMessage(
						chat.id,
						`<a href="${anime.CoverPhotoLink}">\u{1F3A1}</a> <b>${
							anime.Title
						}</b>${
							anime.Description
								? `\n\n<b>Description:</b> <em>${anime.Description}</em>`
								: ""
						}`,
						options
					)
					.then(msg => {
						pages.push({
							insertOne: {
								document: {
									_id: msg.message_id,
									type: this.type,
									user: msg.chat.id,
								},
							},
						});
					})
			);
		});

		await Promise.all(promises);
		/*
		 * Ensure all messages are sent before pagination
		 */
		const pagination = [
			{
				text: keypad.next,
				callback_data: JSON.stringify({
					type: `paginate_${this.type}`,
					page: page + 1,
				}),
			},
		];

		if (page > 1) {
			pagination.unshift({
				text: keypad.previous,
				callback_data: JSON.stringify({
					type: `paginate_${this.type}`,
					page: page - 1,
				}),
			});
		}

		await this.bot
			.sendMessage(
				chat.id,
				`<a href="${paging.CoverPhotoLink}">\u{1F3A1}</a> <b>${
					paging.Title
				}</b>${
					paging.Description
						? `\n\n<b>Description:</b> <em>${paging.Description}</em>`
						: ""
				}`,
				{
					parse_mode: "html",
					reply_markup: JSON.stringify({
						inline_keyboard: [
							[
								{ text: keypad.download, url: paging.DownloadLink },
								{
									text: "Share",
									url: `https://t.me/share/url?url=${paging.DownloadLink}&text=Downloaded%20from%20@${botTGname}`,
								},
							],
							pagination,
						],
					}),
				}
			)
			.then(msg => {
				pages.push({
					insertOne: {
						document: {
							_id: msg.message_id,
							type: this.type,
							user: msg.chat.id,
						},
					},
				});
			});

		await this.bot.deleteMessage(chat.id, message_id);
		await Paginator.bulkWrite(pages);
	}

	/**
	 * Search for movies
	 * @param  {} message
	 * @param  {} params
	 */
	async search({ chat }, params) {
		const { message_id } = await this.bot.sendMessage(
			chat.id,
			`\u{1F4E1} Searching for \`${params.query}\``,
			keyboard
		);

		await this.bot.sendChatAction(chat.id, "typing");
		const { data } = await axios.get(`${this.endpoint}/search`, {
			params: {
				query: params.query.replace(" ", "+"),
				engine: "animeout",
			},
		});

		_.map(data, async anime => {
			const options = { parse_mode: "html" };
			options.reply_markup = JSON.stringify({
				inline_keyboard: [
					[
						{ text: keypad.download, url: anime.DownloadLink },
						{
							text: "Share",
							url: `https://t.me/share/url?url=${anime.DownloadLink}&text=Downloaded%20from%20@${botTGname}`,
						},
					],
				],
			});

			await this.bot.sendMessage(
				chat.id,
				`<a href="${anime.CoverPhotoLink}">\u{1F3A1}</a> <b>${anime.Title}</b>${
					anime.Description
						? `\n\n<b>Description:</b> <em>${anime.Description}</em>`
						: ""
				}`,
				options
			);
		});

		await this.bot.deleteMessage(chat.id, message_id);
	}

	/**
	 * Interactive search
	 * @param  {} message
	 */
	async interactiveSearch(message) {
		const chatId = message.chat.id;
		const { message_id } = await this.bot.sendMessage(
			chatId,
			"\u{1F50D} Tell me the title of the anime you want",
			{ reply_markup: JSON.stringify({ force_reply: true }) }
		);

		const listenerId = this.bot.onReplyToMessage(
			chatId,
			message_id,
			async reply => {
				this.bot.removeReplyListener(listenerId);
				await this.search(message, { query: reply.text });
			}
		);
	}
};
