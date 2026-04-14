# EDU-PUBLISH-CMS

# 简介

为EDU-PUBLISH（源码位于本项目的ref目录中）打造一个前端展示几乎一致，通过github进行交互的直观GUI的CMS

- 前端：和EDU-PUBLISH一致，React19+Vite+TS，大部分组件直接照抄

- 鉴权：githubOAuth
- 部署&后端：Cloudflare Worker

## 期望流程

1. 用户访问worker的域名，出现github的OAuth，用户登录后项目首先会把用户fork的EDU-PUBLISH仓库（当然也可能是其他名字，默认所有用户已经fork了同功能的仓库）的content最新状态给pull下来

2. 随后按照本仓库的前端在线重编译成可编辑的组件，样式参考图的红字：

   ![image-20260414032925688](C:\Users\zengs\AppData\Roaming\Typora\typora-user-images\image-20260414032925688.png)

![image-20260414033037191](C:\Users\zengs\AppData\Roaming\Typora\typora-user-images\image-20260414033037191.png)

3.  用户编辑完后，点击上传，选择分支，可以直接把修改后的content内容给push到EDU-PUBLISH的对应分支，因为EDU-PUBLISH本身就是一个git依赖的项目，所以它那边会自动部署